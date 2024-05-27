/*
  2022-09-16

  The author disclaims copyright to this source code.  In place of a
  legal notice, here is a blessing:

  *   May you do good and not evil.
  *   May you find forgiveness for yourself and forgive others.
  *   May you share freely, never taking more than you give.

  ***********************************************************************

  A Worker which manages asynchronous OPFS handles on behalf of a
  synchronous API which controls it via a combination of Worker
  messages, SharedArrayBuffer, and Atomics. It is the asynchronous
  counterpart of the API defined in sqlite3-vfs-opfs.js.

  Highly indebted to:

  https://github.com/rhashimoto/wa-sqlite/blob/master/src/examples/OriginPrivateFileSystemVFS.js

  for demonstrating how to use the OPFS APIs.

  This file is to be loaded as a Worker. It does not have any direct
  access to the sqlite3 JS/WASM bits, so any bits which it needs (most
  notably SQLITE_xxx integer codes) have to be imported into it via an
  initialization process.

  This file represents an implementation detail of a larger piece of
  code, and not a public interface. Its details may change at any time
  and are not intended to be used by any client-level code.

  2022-11-27: Chrome v108 changes some async methods to synchronous, as
  documented at:

  https://developer.chrome.com/blog/sync-methods-for-accesshandles/

  Firefox v111 and Safari 16.4, both released in March 2023, also
  include this.

  We cannot change to the sync forms at this point without breaking
  clients who use Chrome v104-ish or higher. truncate(), getSize(),
  flush(), and close() are now (as of v108) synchronous. Calling them
  with an "await", as we have to for the async forms, is still legal
  with the sync forms but is superfluous. Calling the async forms with
  theFunc().then(...) is not compatible with the change to
  synchronous, but we do do not use those APIs that way. i.e. we don't
  _need_ to change anything for this, but at some point (after Chrome
  versions (approximately) 104-107 are extinct) should change our
  usage of those methods to remove the "await".
*/
'use strict';
const wPost = (type, ...args) => postMessage({ type, payload: args });
const installAsyncProxy = function () {
  const toss = function (...args) {
    throw new Error(args.join(' '));
  };
  if (globalThis.window === globalThis) {
    toss(
      'This code cannot run from the main thread.',
      'Load it as a Worker from a separate Worker.',
    );
  } else if (!navigator?.storage?.getDirectory) {
    toss('This API requires navigator.storage.getDirectory.');
  }

  const state = Object.create(null);

  state.verbose = 1;

  const loggers = {
    0: console.error.bind(console),
    1: console.warn.bind(console),
    2: console.log.bind(console),
  };
  const logImpl = (level, ...args) => {
    if (state.verbose > level) loggers[level]('OPFS asyncer:', ...args);
  };
  const log = (...args) => logImpl(2, ...args);
  const warn = (...args) => logImpl(1, ...args);
  const error = (...args) => logImpl(0, ...args);
  const metrics = Object.create(null);
  metrics.reset = () => {
    let k;
    const r = (m) => (m.count = m.time = m.wait = 0);
    for (k in state.opIds) {
      r((metrics[k] = Object.create(null)));
    }
    let s = (metrics.s11n = Object.create(null));
    s = s.serialize = Object.create(null);
    s.count = s.time = 0;
    s = metrics.s11n.deserialize = Object.create(null);
    s.count = s.time = 0;
  };
  metrics.dump = () => {
    let k,
      n = 0,
      t = 0,
      w = 0;
    for (k in state.opIds) {
      const m = metrics[k];
      n += m.count;
      t += m.time;
      w += m.wait;
      m.avgTime = m.count && m.time ? m.time / m.count : 0;
    }
    console.log(
      globalThis?.location?.href,
      'metrics for',
      globalThis?.location?.href,
      ':\n',
      metrics,
      '\nTotal of',
      n,
      'op(s) for',
      t,
      'ms',
      'approx',
      w,
      'ms spent waiting on OPFS APIs.',
    );
    console.log('Serialization metrics:', metrics.s11n);
  };

  const __openFiles = Object.create(null);

  const __implicitLocks = new Set();

  const getResolvedPath = function (filename, splitIt) {
    const p = new URL(filename, 'file://irrelevant').pathname;
    return splitIt ? p.split('/').filter((v) => !!v) : p;
  };

  const getDirForFilename = async function f(absFilename, createDirs = false) {
    const path = getResolvedPath(absFilename, true);
    const filename = path.pop();
    let dh = state.rootDir;
    for (const dirName of path) {
      if (dirName) {
        dh = await dh.getDirectoryHandle(dirName, { create: !!createDirs });
      }
    }
    return [dh, filename];
  };

  const closeSyncHandle = async (fh) => {
    if (fh.syncHandle) {
      log('Closing sync handle for', fh.filenameAbs);
      const h = fh.syncHandle;
      delete fh.syncHandle;
      delete fh.xLock;
      __implicitLocks.delete(fh.fid);
      return h.close();
    }
  };

  const closeSyncHandleNoThrow = async (fh) => {
    try {
      await closeSyncHandle(fh);
    } catch (e) {
      warn('closeSyncHandleNoThrow() ignoring:', e, fh);
    }
  };

  const releaseImplicitLocks = async () => {
    if (__implicitLocks.size) {
      for (const fid of __implicitLocks) {
        const fh = __openFiles[fid];
        await closeSyncHandleNoThrow(fh);
        log('Auto-unlocked', fid, fh.filenameAbs);
      }
    }
  };

  const releaseImplicitLock = async (fh) => {
    if (fh.releaseImplicitLocks && __implicitLocks.has(fh.fid)) {
      return closeSyncHandleNoThrow(fh);
    }
  };

  class GetSyncHandleError extends Error {
    constructor(errorObject, ...msg) {
      super(
        [...msg, ': ' + errorObject.name + ':', errorObject.message].join(' '),
        {
          cause: errorObject,
        },
      );
      this.name = 'GetSyncHandleError';
    }
  }
  GetSyncHandleError.convertRc = (e, rc) => {
    if (1) {
      return e instanceof GetSyncHandleError &&
        (e.cause.name === 'NoModificationAllowedError' ||
          (e.cause.name === 'DOMException' &&
            0 === e.cause.message.indexOf('Access Handles cannot')))
        ? state.sq3Codes.SQLITE_BUSY
        : rc;
    } else {
      return rc;
    }
  };

  const getSyncHandle = async (fh, opName) => {
    if (!fh.syncHandle) {
      const t = performance.now();
      log('Acquiring sync handle for', fh.filenameAbs);
      const maxTries = 6,
        msBase = state.asyncIdleWaitTime * 2;
      let i = 1,
        ms = msBase;
      for (; true; ms = msBase * ++i) {
        try {
          fh.syncHandle = await fh.fileHandle.createSyncAccessHandle();
          break;
        } catch (e) {
          if (i === maxTries) {
            throw new GetSyncHandleError(
              e,
              'Error getting sync handle for',
              opName + '().',
              maxTries,
              'attempts failed.',
              fh.filenameAbs,
            );
          }
          warn(
            'Error getting sync handle for',
            opName + '(). Waiting',
            ms,
            'ms and trying again.',
            fh.filenameAbs,
            e,
          );
          Atomics.wait(state.sabOPView, state.opIds.retry, 0, ms);
        }
      }
      log(
        'Got',
        opName + '() sync handle for',
        fh.filenameAbs,
        'in',
        performance.now() - t,
        'ms',
      );
      if (!fh.xLock) {
        __implicitLocks.add(fh.fid);
        log(
          'Acquired implicit lock for',
          opName + '()',
          fh.fid,
          fh.filenameAbs,
        );
      }
    }
    return fh.syncHandle;
  };

  const storeAndNotify = (opName, value) => {
    log(opName + '() => notify(', value, ')');
    Atomics.store(state.sabOPView, state.opIds.rc, value);
    Atomics.notify(state.sabOPView, state.opIds.rc);
  };

  const affirmNotRO = function (opName, fh) {
    if (fh.readOnly) toss(opName + '(): File is read-only: ' + fh.filenameAbs);
  };

  const __mTimer = Object.create(null);
  __mTimer.op = undefined;
  __mTimer.start = undefined;
  const mTimeStart = (op) => {
    __mTimer.start = performance.now();
    __mTimer.op = op;

    ++metrics[op].count;
  };
  const mTimeEnd = () =>
    (metrics[__mTimer.op].time += performance.now() - __mTimer.start);
  const __wTimer = Object.create(null);
  __wTimer.op = undefined;
  __wTimer.start = undefined;
  const wTimeStart = (op) => {
    __wTimer.start = performance.now();
    __wTimer.op = op;
  };
  const wTimeEnd = () =>
    (metrics[__wTimer.op].wait += performance.now() - __wTimer.start);

  let flagAsyncShutdown = false;

  const vfsAsyncImpls = {
    'opfs-async-metrics': async () => {
      mTimeStart('opfs-async-metrics');
      metrics.dump();
      storeAndNotify('opfs-async-metrics', 0);
      mTimeEnd();
    },
    'opfs-async-shutdown': async () => {
      flagAsyncShutdown = true;
      storeAndNotify('opfs-async-shutdown', 0);
    },
    mkdir: async (dirname) => {
      mTimeStart('mkdir');
      let rc = 0;
      wTimeStart('mkdir');
      try {
        await getDirForFilename(dirname + '/filepart', true);
      } catch (e) {
        state.s11n.storeException(2, e);
        rc = state.sq3Codes.SQLITE_IOERR;
      } finally {
        wTimeEnd();
      }
      storeAndNotify('mkdir', rc);
      mTimeEnd();
    },
    xAccess: async (filename) => {
      mTimeStart('xAccess');

      let rc = 0;
      wTimeStart('xAccess');
      try {
        const [dh, fn] = await getDirForFilename(filename);
        await dh.getFileHandle(fn);
      } catch (e) {
        state.s11n.storeException(2, e);
        rc = state.sq3Codes.SQLITE_IOERR;
      } finally {
        wTimeEnd();
      }
      storeAndNotify('xAccess', rc);
      mTimeEnd();
    },
    xClose: async function (fid) {
      const opName = 'xClose';
      mTimeStart(opName);
      __implicitLocks.delete(fid);
      const fh = __openFiles[fid];
      let rc = 0;
      wTimeStart(opName);
      if (fh) {
        delete __openFiles[fid];
        await closeSyncHandle(fh);
        if (fh.deleteOnClose) {
          try {
            await fh.dirHandle.removeEntry(fh.filenamePart);
          } catch (e) {
            warn('Ignoring dirHandle.removeEntry() failure of', fh, e);
          }
        }
      } else {
        state.s11n.serialize();
        rc = state.sq3Codes.SQLITE_NOTFOUND;
      }
      wTimeEnd();
      storeAndNotify(opName, rc);
      mTimeEnd();
    },
    xDelete: async function (...args) {
      mTimeStart('xDelete');
      const rc = await vfsAsyncImpls.xDeleteNoWait(...args);
      storeAndNotify('xDelete', rc);
      mTimeEnd();
    },
    xDeleteNoWait: async function (filename, syncDir = 0, recursive = false) {
      let rc = 0;
      wTimeStart('xDelete');
      try {
        while (filename) {
          const [hDir, filenamePart] = await getDirForFilename(filename, false);
          if (!filenamePart) break;
          await hDir.removeEntry(filenamePart, { recursive });
          if (0x1234 !== syncDir) break;
          recursive = false;
          filename = getResolvedPath(filename, true);
          filename.pop();
          filename = filename.join('/');
        }
      } catch (e) {
        state.s11n.storeException(2, e);
        rc = state.sq3Codes.SQLITE_IOERR_DELETE;
      }
      wTimeEnd();
      return rc;
    },
    xFileSize: async function (fid) {
      mTimeStart('xFileSize');
      const fh = __openFiles[fid];
      let rc = 0;
      wTimeStart('xFileSize');
      try {
        const sz = await (await getSyncHandle(fh, 'xFileSize')).getSize();
        state.s11n.serialize(Number(sz));
      } catch (e) {
        state.s11n.storeException(1, e);
        rc = GetSyncHandleError.convertRc(e, state.sq3Codes.SQLITE_IOERR);
      }
      await releaseImplicitLock(fh);
      wTimeEnd();
      storeAndNotify('xFileSize', rc);
      mTimeEnd();
    },
    xLock: async function (fid, lockType) {
      mTimeStart('xLock');
      const fh = __openFiles[fid];
      let rc = 0;
      const oldLockType = fh.xLock;
      fh.xLock = lockType;
      if (!fh.syncHandle) {
        wTimeStart('xLock');
        try {
          await getSyncHandle(fh, 'xLock');
          __implicitLocks.delete(fid);
        } catch (e) {
          state.s11n.storeException(1, e);
          rc = GetSyncHandleError.convertRc(
            e,
            state.sq3Codes.SQLITE_IOERR_LOCK,
          );
          fh.xLock = oldLockType;
        }
        wTimeEnd();
      }
      storeAndNotify('xLock', rc);
      mTimeEnd();
    },
    xOpen: async function (fid, filename, flags, opfsFlags) {
      const opName = 'xOpen';
      mTimeStart(opName);
      const create = state.sq3Codes.SQLITE_OPEN_CREATE & flags;
      wTimeStart('xOpen');
      try {
        let hDir, filenamePart;
        try {
          [hDir, filenamePart] = await getDirForFilename(filename, !!create);
        } catch (e) {
          state.s11n.storeException(1, e);
          storeAndNotify(opName, state.sq3Codes.SQLITE_NOTFOUND);
          mTimeEnd();
          wTimeEnd();
          return;
        }
        if (state.opfsFlags.OPFS_UNLINK_BEFORE_OPEN & opfsFlags) {
          try {
            await hDir.removeEntry(filenamePart);
          } catch (e) {}
        }
        const hFile = await hDir.getFileHandle(filenamePart, { create });
        wTimeEnd();
        const fh = Object.assign(Object.create(null), {
          fid: fid,
          filenameAbs: filename,
          filenamePart: filenamePart,
          dirHandle: hDir,
          fileHandle: hFile,
          sabView: state.sabFileBufView,
          readOnly: create
            ? false
            : state.sq3Codes.SQLITE_OPEN_READONLY & flags,
          deleteOnClose: !!(state.sq3Codes.SQLITE_OPEN_DELETEONCLOSE & flags),
        });
        fh.releaseImplicitLocks =
          opfsFlags & state.opfsFlags.OPFS_UNLOCK_ASAP ||
          state.opfsFlags.defaultUnlockAsap;
        if (0 && 0 === (flags & state.sq3Codes.SQLITE_OPEN_MAIN_DB)) {
          fh.xLock = 'xOpen';
          await getSyncHandle(fh, 'xOpen');
        }
        __openFiles[fid] = fh;
        storeAndNotify(opName, 0);
      } catch (e) {
        wTimeEnd();
        error(opName, e);
        state.s11n.storeException(1, e);
        storeAndNotify(opName, state.sq3Codes.SQLITE_IOERR);
      }
      mTimeEnd();
    },
    xRead: async function (fid, n, offset64) {
      mTimeStart('xRead');
      let rc = 0,
        nRead;
      const fh = __openFiles[fid];
      try {
        wTimeStart('xRead');
        nRead = (await getSyncHandle(fh, 'xRead')).read(
          fh.sabView.subarray(0, n),
          { at: Number(offset64) },
        );
        wTimeEnd();
        if (nRead < n) {
          fh.sabView.fill(0, nRead, n);
          rc = state.sq3Codes.SQLITE_IOERR_SHORT_READ;
        }
      } catch (e) {
        if (undefined === nRead) wTimeEnd();
        error('xRead() failed', e, fh);
        state.s11n.storeException(1, e);
        rc = GetSyncHandleError.convertRc(e, state.sq3Codes.SQLITE_IOERR_READ);
      }
      await releaseImplicitLock(fh);
      storeAndNotify('xRead', rc);
      mTimeEnd();
    },
    xSync: async function (fid, flags) {
      mTimeStart('xSync');
      const fh = __openFiles[fid];
      let rc = 0;
      if (!fh.readOnly && fh.syncHandle) {
        try {
          wTimeStart('xSync');
          await fh.syncHandle.flush();
        } catch (e) {
          state.s11n.storeException(2, e);
          rc = state.sq3Codes.SQLITE_IOERR_FSYNC;
        }
        wTimeEnd();
      }
      storeAndNotify('xSync', rc);
      mTimeEnd();
    },
    xTruncate: async function (fid, size) {
      mTimeStart('xTruncate');
      let rc = 0;
      const fh = __openFiles[fid];
      wTimeStart('xTruncate');
      try {
        affirmNotRO('xTruncate', fh);
        await (await getSyncHandle(fh, 'xTruncate')).truncate(size);
      } catch (e) {
        error('xTruncate():', e, fh);
        state.s11n.storeException(2, e);
        rc = GetSyncHandleError.convertRc(
          e,
          state.sq3Codes.SQLITE_IOERR_TRUNCATE,
        );
      }
      await releaseImplicitLock(fh);
      wTimeEnd();
      storeAndNotify('xTruncate', rc);
      mTimeEnd();
    },
    xUnlock: async function (fid, lockType) {
      mTimeStart('xUnlock');
      let rc = 0;
      const fh = __openFiles[fid];
      if (state.sq3Codes.SQLITE_LOCK_NONE === lockType && fh.syncHandle) {
        wTimeStart('xUnlock');
        try {
          await closeSyncHandle(fh);
        } catch (e) {
          state.s11n.storeException(1, e);
          rc = state.sq3Codes.SQLITE_IOERR_UNLOCK;
        }
        wTimeEnd();
      }
      storeAndNotify('xUnlock', rc);
      mTimeEnd();
    },
    xWrite: async function (fid, n, offset64) {
      mTimeStart('xWrite');
      let rc;
      const fh = __openFiles[fid];
      wTimeStart('xWrite');
      try {
        affirmNotRO('xWrite', fh);
        rc =
          n ===
          (await getSyncHandle(fh, 'xWrite')).write(fh.sabView.subarray(0, n), {
            at: Number(offset64),
          })
            ? 0
            : state.sq3Codes.SQLITE_IOERR_WRITE;
      } catch (e) {
        error('xWrite():', e, fh);
        state.s11n.storeException(1, e);
        rc = GetSyncHandleError.convertRc(e, state.sq3Codes.SQLITE_IOERR_WRITE);
      }
      await releaseImplicitLock(fh);
      wTimeEnd();
      storeAndNotify('xWrite', rc);
      mTimeEnd();
    },
  };

  const initS11n = () => {
    if (state.s11n) return state.s11n;
    const textDecoder = new TextDecoder(),
      textEncoder = new TextEncoder('utf-8'),
      viewU8 = new Uint8Array(
        state.sabIO,
        state.sabS11nOffset,
        state.sabS11nSize,
      ),
      viewDV = new DataView(
        state.sabIO,
        state.sabS11nOffset,
        state.sabS11nSize,
      );
    state.s11n = Object.create(null);
    const TypeIds = Object.create(null);
    TypeIds.number = {
      id: 1,
      size: 8,
      getter: 'getFloat64',
      setter: 'setFloat64',
    };
    TypeIds.bigint = {
      id: 2,
      size: 8,
      getter: 'getBigInt64',
      setter: 'setBigInt64',
    };
    TypeIds.boolean = {
      id: 3,
      size: 4,
      getter: 'getInt32',
      setter: 'setInt32',
    };
    TypeIds.string = { id: 4 };
    const getTypeId = (v) =>
      TypeIds[typeof v] ||
      toss('Maintenance required: this value type cannot be serialized.', v);
    const getTypeIdById = (tid) => {
      switch (tid) {
        case TypeIds.number.id:
          return TypeIds.number;
        case TypeIds.bigint.id:
          return TypeIds.bigint;
        case TypeIds.boolean.id:
          return TypeIds.boolean;
        case TypeIds.string.id:
          return TypeIds.string;
        default:
          toss('Invalid type ID:', tid);
      }
    };
    state.s11n.deserialize = function (clear = false) {
      ++metrics.s11n.deserialize.count;
      const t = performance.now();
      const argc = viewU8[0];
      const rc = argc ? [] : null;
      if (argc) {
        const typeIds = [];
        let offset = 1,
          i,
          n,
          v;
        for (i = 0; i < argc; ++i, ++offset) {
          typeIds.push(getTypeIdById(viewU8[offset]));
        }
        for (i = 0; i < argc; ++i) {
          const t = typeIds[i];
          if (t.getter) {
            v = viewDV[t.getter](offset, state.littleEndian);
            offset += t.size;
          } else {
            n = viewDV.getInt32(offset, state.littleEndian);
            offset += 4;
            v = textDecoder.decode(viewU8.slice(offset, offset + n));
            offset += n;
          }
          rc.push(v);
        }
      }
      if (clear) viewU8[0] = 0;

      metrics.s11n.deserialize.time += performance.now() - t;
      return rc;
    };
    state.s11n.serialize = function (...args) {
      const t = performance.now();
      ++metrics.s11n.serialize.count;
      if (args.length) {
        const typeIds = [];
        let i = 0,
          offset = 1;
        viewU8[0] = args.length & 0xff;
        for (; i < args.length; ++i, ++offset) {
          typeIds.push(getTypeId(args[i]));
          viewU8[offset] = typeIds[i].id;
        }
        for (i = 0; i < args.length; ++i) {
          const t = typeIds[i];
          if (t.setter) {
            viewDV[t.setter](offset, args[i], state.littleEndian);
            offset += t.size;
          } else {
            const s = textEncoder.encode(args[i]);
            viewDV.setInt32(offset, s.byteLength, state.littleEndian);
            offset += 4;
            viewU8.set(s, offset);
            offset += s.byteLength;
          }
        }
      } else {
        viewU8[0] = 0;
      }
      metrics.s11n.serialize.time += performance.now() - t;
    };

    state.s11n.storeException = state.asyncS11nExceptions
      ? (priority, e) => {
          if (priority <= state.asyncS11nExceptions) {
            state.s11n.serialize([e.name, ': ', e.message].join(''));
          }
        }
      : () => {};

    return state.s11n;
  };

  const waitLoop = async function f() {
    const opHandlers = Object.create(null);
    for (let k of Object.keys(state.opIds)) {
      const vi = vfsAsyncImpls[k];
      if (!vi) continue;
      const o = Object.create(null);
      opHandlers[state.opIds[k]] = o;
      o.key = k;
      o.f = vi;
    }
    while (!flagAsyncShutdown) {
      try {
        if (
          'not-equal' !==
          Atomics.wait(
            state.sabOPView,
            state.opIds.whichOp,
            0,
            state.asyncIdleWaitTime,
          )
        ) {
          await releaseImplicitLocks();
          continue;
        }
        const opId = Atomics.load(state.sabOPView, state.opIds.whichOp);
        Atomics.store(state.sabOPView, state.opIds.whichOp, 0);
        const hnd =
          opHandlers[opId] ?? toss('No waitLoop handler for whichOp #', opId);
        const args = state.s11n.deserialize(true) || [];

        if (hnd.f) await hnd.f(...args);
        else error('Missing callback for opId', opId);
      } catch (e) {
        error('in waitLoop():', e);
      }
    }
  };

  navigator.storage
    .getDirectory()
    .then(function (d) {
      state.rootDir = d;
      globalThis.onmessage = function ({ data }) {
        switch (data.type) {
          case 'opfs-async-init': {
            const opt = data.args;
            for (const k in opt) state[k] = opt[k];
            state.verbose = opt.verbose ?? 1;
            state.sabOPView = new Int32Array(state.sabOP);
            state.sabFileBufView = new Uint8Array(
              state.sabIO,
              0,
              state.fileBufferSize,
            );
            state.sabS11nView = new Uint8Array(
              state.sabIO,
              state.sabS11nOffset,
              state.sabS11nSize,
            );
            Object.keys(vfsAsyncImpls).forEach((k) => {
              if (!Number.isFinite(state.opIds[k])) {
                toss('Maintenance required: missing state.opIds[', k, ']');
              }
            });
            initS11n();
            metrics.reset();
            log('init state', state);
            wPost('opfs-async-inited');
            waitLoop();
            break;
          }
          case 'opfs-async-restart':
            if (flagAsyncShutdown) {
              warn(
                'Restarting after opfs-async-shutdown. Might or might not work.',
              );
              flagAsyncShutdown = false;
              waitLoop();
            }
            break;
          case 'opfs-async-metrics':
            metrics.dump();
            break;
        }
      };
      wPost('opfs-async-loaded');
    })
    .catch((e) => error('error initializing OPFS asyncer:', e));
};
if (!globalThis.SharedArrayBuffer) {
  wPost(
    'opfs-unavailable',
    'Missing SharedArrayBuffer API.',
    'The server must emit the COOP/COEP response headers to enable that.',
  );
} else if (!globalThis.Atomics) {
  wPost(
    'opfs-unavailable',
    'Missing Atomics API.',
    'The server must emit the COOP/COEP response headers to enable that.',
  );
} else if (
  !globalThis.FileSystemHandle ||
  !globalThis.FileSystemDirectoryHandle ||
  !globalThis.FileSystemFileHandle ||
  !globalThis.FileSystemFileHandle.prototype.createSyncAccessHandle ||
  !navigator?.storage?.getDirectory
) {
  wPost('opfs-unavailable', 'Missing required OPFS APIs.');
} else {
  installAsyncProxy();
}
