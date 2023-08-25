/** Types of values that can be passed to/retrieved from SQLite. */
declare type SqlValue =
  | string
  | number
  | null
  | Uint8Array
  | Int8Array
  | ArrayBuffer;

/** Internal data types supported by SQLite3. */
declare type SQLiteDataType =
  | CAPI['SQLITE_INTEGER']
  | CAPI['SQLITE_FLOAT']
  | CAPI['SQLITE_TEXT']
  | CAPI['SQLITE_BLOB']
  | CAPI['SQLITE_NULL'];

/** Specifies parameter bindings. */
declare type BindingSpec =
  | SqlValue[]
  | { [paramName: string]: SqlValue }
  /** Assumed to have binding index `1` */
  | SqlValue;

/**
 * Certain WASM-bound APIs, where explicitly noted, have additional string-type
 * argument conversions colloquially known as "flexible strings." This support
 * is generally reserved for arguments which expect SQL strings, as such strings
 * are often large and frequently come from external sources, e.g. byte arrays
 * loaded from local files, over XHR requests, or using `fetch()`. Functions
 * which take filename strings, and simlilar "small" strings, do not use this
 * feature.
 */
declare type FlexibleString =
  | string
  /** WASM C-string pointer, passed on to WASM as-is. */
  | WasmPointer
  /** Assumed to hold UTF-8 encoded text, converted to `string` */
  | Uint8Array
  | Int8Array
  | ArrayBuffer
  /**
   * Gets converted to a string using `theArray.join('')` (i.e. concatenated
   * as-is, with no space between each entry). Though JS supports multi-line
   * string literals with the backtick syntax, it is frequently convenient to
   * write out longer SQL constructs as arrays.
   */
  | string[];

/**
 * Prepared statements are created solely through the {@link Database#prepare}
 * method. Calling the constructor directly will trigger an exception.
 *
 * It is important that statements be finalized in a timely manner, else clients
 * risk introducing locking errors later on in their apps.
 *
 * By and large, clients can avoid statement lifetime issues by using the
 * {@link Database#exec} method. For cases when more control or flexibility is
 * needed, however, clients will need to {@link Database#prepare} statements and
 * then ensure that their lifetimes are properly managed. The simplest way to do
 * this is with a `try`/`finally` block, as in this example:
 *
 * @example
 *   const stmt = myDb.prepare("...");
 *   try {
 *   ... use the stmt object ...
 *   } finally {
 *   stmt.finalize();
 *   }
 */
declare class PreparedStatement {
  /** Binds one more values to its bindable parameters. */
  bind(binding: BindingSpec): this;

  /**
   * Binds a value to a bindable parameter.
   *
   * @param idx The index of the bindable parameter to bind to, **ACHTUNG**:
   *   1-based!
   */
  bind(idx: number, binding: SqlValue): this;

  /**
   * Special case of {@link PreparedStatement#bind} which binds the given value
   * using the `BLOB` binding mechanism instead of the default selected one for
   * the value. Index can be the index number (**ACHTUNG**: 1-based!) or the
   * string corresponding to a named parameter.
   */
  bindAsBlob(
    value: string | null | undefined | Uint8Array | Int8Array | ArrayBuffer,
  ): this;
  bindAsBlob(
    idx: number | string,
    value: string | null | undefined | Uint8Array | Int8Array | ArrayBuffer,
  ): this;

  /** Clears all bound values. */
  clearBindings(): this;

  /**
   * "Finalizes" this statement. This is a no-op if the statement has already
   * been finalized. Returns the value of the underlying `sqlite3_finalize()`
   * call (0 on success, non-0 on error) or `undefined` if the statement has
   * already been finalized. It does not throw if `sqlite3_finalize()` returns
   * non-0 because this function is effectively a destructor and "destructors do
   * not throw." This function will throw if it is called while the statement is
   * in active use via a {@link Database#exec} callback.
   */
  finalize(): number | undefined;

  /**
   * Fetches the value from the given 0-based column index of the current data
   * row, throwing if index is out of range.
   *
   * Requires that {@link PreparedStatement#step} has just returned a truthy
   * value, else an exception is thrown.
   *
   * By default it will determine the data type of the result automatically. If
   * passed a second arugment, it must be one of the enumeration values for
   * sqlite3 types, which are defined as members of the sqlite3 namespace:
   * `SQLITE_INTEGER`, `SQLITE_FLOAT`, `SQLITE_TEXT`, `SQLITE_BLOB`. Any other
   * value, except for `undefined`, will trigger an exception. Passing
   * `undefined` is the same as not passing a value. It is legal to, e.g., fetch
   * an integer value as a string, in which case sqlite3 will convert the value
   * to a string.
   *
   * If the index is an array, this function behaves a differently: it assigns
   * the indexes of the array, from 0 to the number of result columns, to the
   * values of the corresponding result column, and returns that array:
   *
   *     const values = stmt.get([]);
   *
   * This will return an array which contains one entry for each result column
   * of the statement's current row..
   *
   * If the index is a plain object, this function behaves even differentlier:
   * it assigns the properties of the object to the values of their
   * corresponding result columns:
   *
   *     const values = stmt.get({});
   *
   * This returns an object with properties named after the columns of the
   * result set. Be aware that the ordering of the properties is undefined. If
   * their order is important, use the array form instead.
   *
   * Blobs are returned as `Uint8Array` instances.
   *
   * Special case handling of 64-bit integers: the `Number` type is used for
   * both floating point numbers and integers which are small enough to fit into
   * it without loss of precision. If a larger integer is fetched, it is
   * returned as a `BigInt` if that support is enabled, else it will throw an
   * exception. The range of integers supported by the Number class is defined
   * as:
   *
   * - `Number.MIN_SAFE_INTEGER = -9007199254740991`
   * - `Number.MAX_SAFE_INTEGER = 9007199254740991`
   */
  get(ndx: number, asType?: SQLiteDataType): SqlValue;
  get(ndx: SqlValue[]): SqlValue[];
  get(ndx: { [columnName: string]: SqlValue }): {
    [columnName: string]: SqlValue;
  };

  /**
   * Equivalent to {@link PreparedStatement#get(ndx)} but coerces the result to a
   * `Uint8Array`.
   */
  getBlob(ndx: number): Uint8Array | null;

  /**
   * Returns the result column name of the given index, or throws if index is
   * out of bounds or this statement has been finalized. This may be used
   * without having run {@link PreparedStatement#step()} first.
   */
  getColumnName(ndx: number): string;

  /**
   * If this statement potentially has result columns, this function returns an
   * array of all such names. If passed an array, it is used as the target and
   * all names are appended to it. Returns the target array. Throws if this
   * statement cannot have result columns. `this.columnCount`, set with the
   * statement is prepared, holds the number of columns.
   */
  getColumnNames(target?: string[]): string[];

  /**
   * Equivalent to {@link PreparedStatement#get(ndx)} but coerces the result to a
   * number.
   */
  getFloat(ndx: number): number | null;

  /**
   * Equivalent to {@link PreparedStatement#get(ndx)} but coerces the result to
   * an integral number.
   */
  getInt(ndx: number): number | null;

  /**
   * Equivalent to {@link PreparedStatement#getString(ndx)} but returns passes
   * the result of passing the fetched string string through `JSON.parse()`. If
   * JSON parsing throws, that exception is propagated.
   */
  getJSON(ndx: number): any;

  /**
   * If this statement has named bindable parameters and the given name matches
   * one, its 1-based bind index is returned. If no match is found, 0 is
   * returned. If it has no bindable parameters, the undefined value is
   * returned.
   */
  getParamIndex(name: string): number | undefined;

  /**
   * Equivalent to {@link PreparedStatement#get(ndx)} but coerces the result to a
   * string.
   */
  getString(ndx: number): string | null;

  /**
   * Resets this statement so that it may be `step()`ed again from the
   * beginning. Returns `this`. Throws if this statement has been finalized, if
   * it may not legally be reset because it is currently being used from a
   * {@link Database#exec} callback, or (as of versions 3.42.1 and 3.43) if the
   * underlying call to `sqlite3_reset()` returns non-0.
   *
   * If passed a truthy argument then {@link PreparedStatement#clearBindings} is
   * also called, otherwise any existing bindings, along with any memory
   * allocated for them, are retained.
   *
   * In versions 3.42.0 and earlier, this function did not throw if
   * `sqlite3_reset()` returns non-0, but it was discovered that throwing (or
   * significant extra client-side code) is necessary in order to avoid certain
   * silent failure scenarios
   */
  reset(alsoClearBinds?: boolean): this;

  /**
   * Steps the statement one time. If the result indicates that a row of data is
   * available, a truthy value is returned. If no row of data is available, a
   * falsy value is returned. Throws on error.
   */
  step(): boolean;

  /**
   * Functions like {@link PreparedStatement#step} except that it calls
   * {@link PreparedStatement#finalize} on this statement immediately after
   * stepping unless the `step()` throws.
   *
   * On success, it returns true if the step indicated that a row of data was
   * available, else it returns false.
   *
   * This is intended to simplify use cases such as:
   *
   *     ADb.prepare('INSERT INTO foo(a) VALUES(?)').bind(123).stepFinalize();
   */
  stepFinalize(): boolean;

  /**
   * Functions exactly like {@link PreparedStatement#step} except that...
   *
   * On success, it calls {@link PreparedStatement#reset} and returns this
   * object. On error, it throws and does not call reset().
   *
   * This is intended to simplify constructs like:
   *
   *     For(...) { stmt.bind(...).stepReset(); }
   *
   * Note that the {@link PreparedStatement#reset} call makes it illegal to call
   * {@link PreparedStatement#get} after the step.
   */
  stepReset(): this;

  /**
   * The number of result columns this statement has, or 0 for statements which
   * do not have result columns.
   *
   * _Minor achtung:_ for all releases > 3.42.0 this is a property interceptor
   * which invokes `sqlite3_column_count`, so its use should be avoided in loops
   * because of the call overhead. In versions <= 3.42.0 this value is collected
   * and cached when the statement is created, but that can lead to misbehavior
   * if changes are made to the database schema while this statement is active.
   */
  columnCount: number;

  /** The number of bindable parameters this statement has. */
  parameterCount: number;

  /**
   * WASM pointer rwhich resolves to the `sqlite3_stmt*` which this object
   * wraps. This value may be passed to any WASM-bound functions which accept an
   * `sqlite3_stmt*` argument. It resolves to `undefined` after this statement
   * is {@link PreparedStatement#finalize}d.
   */
  pointer: WasmPointer | undefined;
}

declare type ExecOptions = {
  /**
   * The SQL to run (unless it's provided as the first argument). The SQL may
   * contain any number of statements.
   */
  sql?: FlexibleString;

  /**
   * A single value valid as an argument for {@link PreparedStatement#bind}. This
   * is only applied to the first non-empty statement in the SQL which has any
   * bindable parameters. (Empty statements are skipped entirely.)
   */
  bind?: BindingSpec;

  /**
   * If set, the SQL of each executed statement is appended to this array before
   * the statement is executed (but after it is prepared - we don't have the
   * string until after that). Empty SQL statements are elided.
   */
  saveSql?: string[];

  /**
   * A string specifying what this function should return: The default value is
   * (usually) `"this"`. The exceptions is if the caller passes neither of
   * `callback` nor `returnValue` but does pass an explicit `rowMode` then the
   * default returnValue is `"resultRows"`, described below. The options are:
   *
   * - `"this"` menas that the DB object itself should be returned.
   * - `"resultRows"` means to return the value of the `resultRows` option. If
   *   `resultRows` is not set, this function behaves as if it were set to an
   *   empty array.
   * - `"saveSql"` means to return the value of the `saveSql` option. If `saveSql`
   *   is not set, this function behaves as if it were set to an empty array.
   */
  returnValue?: 'this' | 'resultRows' | 'saveSql';

  /**
   * A function which gets called for each row of the result set (see `rowMode`,
   * below), but only if that statement has any result rows. The callback's
   * `this` is the `options` object, noting that this function will synthesize
   * one if the caller does not provide one. The second argument passed to the
   * callback is always the current {@link PreparedStatement} object, as it's
   * needed if the caller wants to fetch the column names or some such (noting
   * that they could also be fetched via `this.columnNames`, if the client
   * provides the `columnNames` option). If the callback returns a literal
   * `false` (as opposed to any other falsy value, e.g. an implicit undefined
   * return), any ongoing statement-`step()` iteration stops without an error.
   * The return value of the callback is otherwise ignored.
   *
   * Applies only to the first statement which has a non-zero result column
   * count, regardless of whether the statement actually produces any result
   * rows.
   *
   * **ACHTUNG:** the callback **MUST NOT** modify the {@link PreparedStatement}
   * object. Calling any of the {@link PreparedStatement#get} variants,
   * {@link PreparedStatement#getColumnName}, or similar, is legal, but calling
   * {@link PreparedStatement#step} or {@link PreparedStatement#finalize} is not.
   * Member methods which are illegal in this context will trigger an exception,
   * but clients must also refrain from using any lower-level (C-style) APIs
   * which might modify the statement.
   */
  callback?: (
    row:
      | SqlValue[]
      | { [columnName: string]: SqlValue }
      | PreparedStatement
      | SqlValue,
    stmt: PreparedStatement,
  ) => void | false;

  /**
   * If this is an array, the column names of the result set are stored in this
   * array before the `callback` (if any) is triggered (regardless of whether
   * the query produces any result rows). If no statement has result columns,
   * this value is unchanged.
   *
   * Applies only to the first statement which has a non-zero result column
   * count, regardless of whether the statement actually produces any result
   * rows.
   *
   * **Achtung:** an SQL result may have multiple columns with identical names.
   */
  columnNames?: string[];

  /**
   * If this is an array, it functions similarly to the `callback` option: each
   * row of the result set (if any), with the exception that the `rowMode`
   * `'stmt'` is not legal. It is legal to use both `resultRows` and callback,
   * but `resultRows` is likely much simpler to use for small data sets and can
   * be used over a WebWorker-style message interface. `exec()` throws if
   * `resultRows` is set and rowMode is `'stmt'`.
   *
   * Applies only to the first statement which has a non-zero result column
   * count, regardless of whether the statement actually produces any result
   * rows.
   */
  resultRows?: (SqlValue[] | { [columnName: string]: SqlValue } | SqlValue)[];

  /**
   * Specifies the type of he `callback`'s first argument and the type of the
   * `resultRows` array entries.
   */
  rowMode?: 'array' | 'object' | 'stmt' | number | string;
};

/**
 * Derivate type of ExecOptions to be used as base mixin for method overloads on
 * `exec`
 */
declare type ExecBaseOptions = Omit<
  ExecOptions,
  'callback' | 'resultRows' | 'rowMode' | 'returnValue' | 'sql'
>;

declare type ExecReturnThisOptions = {
  returnValue?: 'this';
};

declare type ExecReturnResultRowsOptions = {
  returnValue: 'resultRows';
};

declare type ExecReturnSaveSqlOptions = {
  returnValue: 'saveSql';
};

declare type ExecRowModeArrayOptions = {
  callback?: (row: SqlValue[]) => void | false;
  resultRows?: SqlValue[][];
  rowMode?: 'array';
};

declare type ExecRowModeObjectOptions = {
  callback?: (row: { [columnName: string]: SqlValue }) => void | false;
  resultRows?: { [columnName: string]: SqlValue }[];
  rowMode: 'object';
};

declare type ExecRowModeStmtOptions = {
  callback?: (row: PreparedStatement) => void | false;
  resultRows?: undefined;
  rowMode: 'stmt';
};

declare type ExecRowModeScalarOptions = {
  callback?: (row: SqlValue) => void | false;
  resultRows?: SqlValue[];

  /**
   * For number values: indicates a zero-based column in the result row. Only
   * that one single value will be passed on. If string. For string values: A
   * string with a minimum length of 2 and leading character of `$` will fetch
   * the row as an object, extract that one field, and pass that field's value
   * to the `callback`. Note that these keys are case-sensitive so must match
   * the case used in the SQL. e.g. `"select a A from t"` with a `rowMode` of
   * `'$A'` would work but `'$a'` would not. A reference to a column not in the
   * result set will trigger an exception on the first row (as the check is not
   * performed until rows are fetched).
   */
  rowMode: number | Exclude<string, 'stmt' | 'array' | 'object'>;
};

/** Options for creating a user-defined function that can be called from SQL. */
declare type FunctionOptions = {
  /**
   * Number of arguments which SQL calls to this function expect or require. The
   * default value is `X.length` MINUS 1, where X is either `xFunc` or `xStep`,
   * depending on the type of function being created. As a special case, if
   * `X.length` is 0, its arity is also 0 instead of -1. A negative arity value
   * means that the function is variadic and may accept any number of arguments,
   * up to sqlite3's compile-time limits. sqlite3 will enforce the argument
   * count if is zero or greater. The callback always receives a pointer to an
   * `sqlite3_context` object as its first argument. Any arguments after that
   * are from SQL code. The leading context argument does not count towards the
   * function's arity. See the docs for `sqlite3_create_function()` for why that
   * argument is required in the interface.
   */
  arity?: number;

  /**
   * Corresponds to the `SQLITE_DETERMINISTIC` flag. Setting it means that the
   * new function always gives the same output when the input parameters are the
   * same. The `abs()` function is deterministic, for example, but
   * `randomblob()` is not. Functions must be deterministic in order to be used
   * in certain contexts such as with the `WHERE` clause of partial indexes or
   * in generated columns. SQLite might also optimize deterministic functions by
   * factoring them out of inner loops.
   */
  deterministic?: boolean;

  /**
   * Corresponds to the `SQLITE_DIRECTONLY` flag.
   *
   * Setting it means that the function may only be invoked from top-level SQL,
   * and cannot be used in `VIEW`s or `TRIGGER`s nor in schema structures such
   * as `CHECK` constraints, `DEFAULT` clauses, expression indexes, partial
   * indexes, or generated columns.
   *
   * The flag is recommended for any application-defined SQL function that has
   * side-effects or that could potentially leak sensitive information. This
   * will prevent attacks in which an application is tricked into using a
   * database file that has had its schema surreptiously modified to invoke the
   * application-defined function in ways that are harmful.
   *
   * Some people say it is good practice to set the flag on all
   * application-defined SQL functions, regardless of whether or not they are
   * security sensitive, as doing so prevents those functions from being used
   * inside of the database schema, and thus ensures that the database can be
   * inspected and modified using generic tools (such as the CLI) that do not
   * have access to the application-defined functions.
   */
  directOnly?: boolean;

  /**
   * Corresponds to the `SQLITE_INNOCUOUS` flag.
   *
   * Setting it means that the function is unlikely to cause problems even if
   * misused. An innocuous function should have no side effects and should not
   * depend on any values other than its input parameters. The `abs()` function
   * is an example of an innocuous function. The `load_extension()` SQL function
   * is not innocuous because of its side effects. The flag is similar to
   * {@link FunctionOptions#directOnly}, but is not exactly the same. The
   * `random()` function is an example of a function that is innocuous but not
   * deterministic.
   *
   * Some heightened security settings (`SQLITE_DBCONFIG_TRUSTED_SCHEMA` and
   * `PRAGMA trusted_schema=OFF`) disable the use of SQL functions inside views
   * and triggers and in schema structures such as `CHECK` constraints,
   * `DEFAULT` clauses, expression indexes, partial indexes, and generated
   * columns unless the function is tagged with `SQLITE_INNOCUOUS`. Most
   * built-in functions are innocuous. Developers are advised to avoid using the
   * `SQLITE_INNOCUOUS` flag for application-defined functions unless the
   * function has been carefully audited and found to be free of potentially
   * security-adverse side-effects and information-leaks.
   */
  innocuous?: boolean;

  /** Name of the user-defined function. */
  name?: string;

  /**
   * The options object may optionally have an xDestroy function-type property,
   * as per `sqlite3_create_function_v2()`. Its argument will be the
   * WASM-pointer-type value of the pApp property, and this function will throw
   * if pApp is defined but is not null, undefined, or a numeric (WASM pointer)
   * value. i.e. pApp, if set, must be value suitable for use as a WASM pointer
   * argument, noting that null or undefined will translate to 0 for that
   * purpose.
   */
  xDestroy?: (pAppPtr: WasmPointer) => void;
};

declare type ScalarFunctionOptions = FunctionOptions & {
  /** Scalar function to be defined. */
  xFunc: (ctxPtr: number, ...args: any[]) => any;
};

declare type AggregateFunctionOptions = FunctionOptions & {
  /**
   * 'Step' callback for an aggregate function.
   *
   * It is invoked to add a row to the current aggregate value. The function
   * arguments, if any, corresponding to the row being added are passed to the
   * implementation of {@link AggregateFunctionOptions#xStep}.
   */
  xStep: (ctxPtr: number, ...rowValues: SqlValue[]) => void;

  /**
   * 'Final' callback for an aggregate function.
   *
   * It is invoked to return the current value of the aggregate, and to free any
   * resources allocated by earlier calls to
   * {@link AggregateFunctionOptions#xStep}.
   */
  xFinal: (ctxPtr: number) => SqlValue;
};

declare type WindowFunctionOptions = FunctionOptions & {
  /**
   * 'Step' callback for a window function.
   *
   * It is invoked to add a row to the current window. The function arguments,
   * if any, corresponding to the row being added are passed to the
   * implementation of {@link WindowFunctionOptions#xStep}.
   */
  xStep: (ctxPtr: number, ...args: any[]) => void;

  /**
   * 'Final' callback for a window function.
   *
   * It is invoked to return the current value of the aggregate (determined by
   * the contents of the current window), and to free any resources allocated by
   * earlier calls to {@link WindowFunctionOptions#xStep}.
   */
  xFinal: (ctxPtr: number) => SqlValue;

  /**
   * 'Value' callback for a window function. This method is invoked to return
   * the current value of the aggregate. Unlike
   * {@link WindowFunctionOptions#xFinal}, the implementation should not delete
   * any context.
   */
  xValue: (ctxPtr: number) => SqlValue;

  /**
   * 'Inverse' callback for a window function.
   *
   * It is invoked to remove the oldest presently aggregated result of
   * {@link WindowFunctionOptions#xStep} from the current window. The function
   * arguments, if any, are those passed to {@link WindowFunctionOptions#xStep}
   * for the row being removed.
   */
  xInverse: (ctxPtr: number, ...args: any[]) => void;
};

/**
 * An instance of an implementing class corresponds to one `sqlite3*` created
 * using `sqlite3_open` or equivalent.
 *
 * @example
 *   ```typescript
 *   const db = new sqlite3.DB();
 *   try {
 *     db.exec([
 *       "create table t(a);",
 *       "insert into t(a) values(10),(20),(30)"
 *     ]);
 *   } finally {
 *     db.close();
 *   }
 *   ```;
 */
declare class Database {
  /**
   * Creates a connection to the given file, optionally creating it if needed.
   *
   * @param options The options to use when opening the database file.
   * @param options.filename The filename to open. Must be resolvable using
   *   whatever filesystem layer (virtual or otherwise) is set up for the
   *   default sqlite3 VFS. Note that the special sqlite3 db names `":memory:"`
   *   and `""` (temporary db) have their normal special meanings here.
   * @param options.flags The flags to use when opening the file. It must be a
   *   string containing a sequence of letters (in any order, but case
   *   sensitive) specifying the mode:
   *
   *   - `c`: create if it does not exist, else fail if it does not exist. Implies
   *       the `w` flag.
   *   - `w`: write. Implies `r`: a db cannot be write-only.
   *   - `r`: read-only if neither `w` nor `c` are provided, else it is ignored.
   *   - `t`: enable tracing of SQL executed on this database handle, sending it to
   *       `console.log()`. To disable it later, call
   *       `sqlite3.capi.sqlite3_trace_v2(thisDb.pointer, 0, 0, 0)`. If `w` is
   *       not provided, the db is implicitly read-only, noting that `rc` is
   *       meaningless. Any other letters are currently ignored. The default is
   *       `c`. These modes are ignored for the special `":memory:"` and `""`
   *       names and may be ignored by specific VFSes.
   */
  constructor(options?: { filename?: string; flags?: string; vfs?: string }); // ✓

  /**
   * Creates a connection to the given file, optionally creating it if needed.
   *
   * @param filename The filename to open. Must be resolvable using whatever
   *   filesystem layer (virtual or otherwise) is set up for the default sqlite3
   *   VFS. Note that the special sqlite3 db names `":memory:"` and `""`
   *   (temporary db) have their normal special meanings here.
   * @param flags The flags to use when opening the file. It must be a string
   *   containing a sequence of letters (in any order, but case sensitive)
   *   specifying the mode:
   *
   *   - `c`: create if it does not exist, else fail if it does not exist. Implies
   *       the `w` flag.
   *   - `w`: write. Implies `r`: a db cannot be write-only.
   *   - `r`: read-only if neither `w` nor `c` are provided, else it is ignored.
   *   - `t`: enable tracing of SQL executed on this database handle, sending it to
   *       `console.log()`. To disable it later, call
   *       `sqlite3.capi.sqlite3_trace_v2(thisDb.pointer, 0, 0, 0)`. If `w` is
   *       not provided, the db is implicitly read-only, noting that `rc` is
   *       meaningless. Any other letters are currently ignored. The default is
   *       `c`. These modes are ignored for the special `":memory:"` and `""`
   *       names and may be ignored by specific VFSes.
   */
  constructor(filename?: string, flags?: string, vfs?: string); // ✓

  /** Filename which was passed to the constructor. */
  filename: string; // ✓

  /**
   * Resolves to the `sqlite3*` which this object wraps. This value may be
   * passed to any WASM-bound functions which accept an `sqlite3*` argument. It
   * resolves to `undefined` after this object is `close()`d.
   */
  pointer?: WasmPointer; // ✓

  /** Callbacks called immediately before/after database is closed. */
  onclose?: {
    before?: (db: Database) => void;
    after?: (db: Database) => void;
  }; // ✓

  /**
   * Executes SQL statements and optionally collects query results and/or calls
   * a callback for each result row.
   *
   * _LOTS_ of overloads on this one one, depending on:
   *
   * - `sql` as parameter or as option
   * - `returnValue`:
   *
   *   - `"this"`: default, return database instance, use for fluent calls
   *   - `"resultRows"`: return values of `resultRows` array (set to empty array if
   *       not set by user)
   *   - `"saveSql"`: return values of `saveSql` option (set to empty array if not
   *       set by user)
   * - `resultRows`:
   *
   *   - `"array"`: Array of column values for every result row
   *   - `"object"`: Object mapping column names to values for every result row
   *   - `"stmt"`: Only for use with `callback` option, pass
   *       {@link PreparedStatement} object for every row.
   *   - `number`: Extract column with (zero-based) index from every result row
   *   - `string`: Extract column with name from every result row, must have format
   *       `$<column>`, with `column` having at least two characters.
   *
   * ⚠️**ACHTUNG**⚠️: The combination of `returnValue: "resultRows"` and
   * `rowMode: "stmt"` type checks fine, but will lead to a runtime error. This
   * is due to a limitation in TypeScript's type system which does not allow
   * restrictions on `string` types.
   */
  exec(
    sql: FlexibleString,
    opts?: (ExecBaseOptions &
      ExecRowModeArrayOptions &
      ExecReturnThisOptions) & {
      sql?: undefined;
    },
  ): this;
  exec(
    opts: (ExecBaseOptions &
      ExecRowModeArrayOptions &
      ExecReturnThisOptions) & { sql: FlexibleString },
  ): this;
  exec(
    sql: FlexibleString,
    opts: ExecBaseOptions &
      ExecRowModeObjectOptions &
      ExecReturnThisOptions & {
        sql?: undefined;
      },
  ): this;
  exec(
    opts: ExecBaseOptions &
      ExecRowModeObjectOptions &
      ExecReturnThisOptions & {
        sql: FlexibleString;
      },
  ): this;
  exec(
    sql: FlexibleString,
    opts: ExecBaseOptions &
      ExecRowModeStmtOptions &
      ExecReturnThisOptions & {
        sql?: undefined;
      },
  ): this;
  exec(
    opts: ExecBaseOptions &
      ExecRowModeStmtOptions &
      ExecReturnThisOptions & {
        sql: FlexibleString;
      },
  ): this;
  exec(
    sql: FlexibleString,
    opts: ExecBaseOptions &
      ExecRowModeScalarOptions &
      ExecReturnThisOptions & {
        sql?: undefined;
      },
  ): this;
  exec(
    opts: ExecBaseOptions &
      ExecRowModeScalarOptions &
      ExecReturnThisOptions & {
        sql: FlexibleString;
      },
  ): this;
  exec(
    sql: FlexibleString,
    opts: ExecBaseOptions &
      ExecRowModeArrayOptions &
      ExecReturnResultRowsOptions & {
        sql?: undefined;
      },
  ): SqlValue[][];
  exec(
    opts: ExecBaseOptions &
      ExecRowModeArrayOptions &
      ExecReturnResultRowsOptions & {
        sql: FlexibleString;
      },
  ): SqlValue[][];
  exec(
    sql: FlexibleString,
    opts: ExecBaseOptions &
      ExecRowModeObjectOptions &
      ExecReturnResultRowsOptions & {
        sql?: undefined;
      },
  ): { [columnName: string]: SqlValue }[];
  exec(
    opts: ExecBaseOptions &
      ExecRowModeObjectOptions &
      ExecReturnResultRowsOptions & {
        sql: FlexibleString;
      },
  ): { [columnName: string]: SqlValue }[];
  exec(
    sql: FlexibleString,
    opts: ExecBaseOptions &
      ExecRowModeScalarOptions &
      ExecReturnResultRowsOptions & {
        sql?: undefined;
      },
  ): SqlValue[];
  exec(
    opts: ExecBaseOptions &
      ExecRowModeScalarOptions &
      ExecReturnResultRowsOptions & {
        sql: FlexibleString;
      },
  ): SqlValue[];
  exec(
    sql: FlexibleString,
    opts: ExecBaseOptions &
      ExecRowModeArrayOptions &
      ExecReturnSaveSqlOptions & {
        sql?: undefined;
      },
  ): string[];
  exec(
    opts: ExecBaseOptions &
      ExecRowModeArrayOptions &
      ExecReturnSaveSqlOptions & {
        sql: FlexibleString;
      },
  ): string[];
  exec(
    sql: FlexibleString,
    opts: ExecBaseOptions &
      ExecRowModeObjectOptions &
      ExecReturnSaveSqlOptions & {
        sql?: undefined;
      },
  ): string[];
  exec(
    opts: ExecBaseOptions &
      ExecRowModeObjectOptions &
      ExecReturnSaveSqlOptions & {
        sql: FlexibleString;
      },
  ): string[];
  exec(
    sql: FlexibleString,
    opts: ExecBaseOptions &
      ExecRowModeStmtOptions &
      ExecReturnSaveSqlOptions & {
        sql?: undefined;
      },
  ): string[];
  exec(
    opts: ExecBaseOptions &
      ExecRowModeStmtOptions &
      ExecReturnSaveSqlOptions & {
        sql: FlexibleString;
      },
  ): string[];
  exec(
    sql: FlexibleString,
    opts: ExecBaseOptions &
      ExecRowModeScalarOptions &
      ExecReturnSaveSqlOptions & {
        sql?: undefined;
      },
  ): string[];
  exec(
    opts: ExecBaseOptions &
      ExecRowModeScalarOptions &
      ExecReturnSaveSqlOptions & {
        sql: FlexibleString;
      },
  ): string[];

  /**
   * Compiles the given SQL and returns a {@link PreparedStatement}. This is the
   * only way to create new {@link PreparedStatement} objects. Throws on error.
   */
  prepare(sql: FlexibleString): PreparedStatement;

  /** Returns true if the database handle is open, else false. */
  isOpen(): boolean;

  /** Throws if the given DB has been closed. */
  affirmOpen(): this;

  /**
   * Finalizes all still-open statements which were opened by this object and
   * closes this database connection. This is a no-op if the db has already been
   * closed. After calling `close()`, {@link pointer} will resolve to
   * `undefined`, so that can be used to check whether the db instance is still
   * opened.
   *
   * If {@link onclose.before} is a function then it is called before any
   * close-related cleanup. If {@link onclose.after} is a function then it is
   * called after the db is closed but before auxiliary state like this.filename
   * is cleared.
   *
   * Both onclose handlers are passed this object as their only argument. If
   * this db is not opened, neither of the handlers are called. Any exceptions
   * the handlers throw are ignored because "destructors must not throw."
   *
   * Note that garbage collection of a db handle, if it happens at all, will
   * never trigger `close()`, so {@link onclose} handlers are not a reliable way
   * to implement close-time cleanup or maintenance of a db.
   */
  close(): void; // ✓

  /**
   * Returns the number of changes, as per `sqlite3_changes()` (if the first
   * argument is `false`) or `sqlite3_total_changes()` (if it's `true`). If the
   * 2nd argument is `true`, it uses `sqlite3_changes64()` or
   * `sqlite3_total_changes64()`, which will trigger an exception if this build
   * does not have `BigInt` support enabled.
   */
  changes(total?: boolean, sixtyFour?: boolean): number;

  /**
   * Returns the filename associated with the given database name. Defaults to
   * `main`. Throws if this database is `close()`d.
   */
  dbFilename(dbName?: string): string | null;

  /**
   * Returns the name of the given 0-based db number. Defaults to `0`. Throws if
   * this database is `close()`d.
   */
  dbName(dbIndex?: number): string | null;

  /**
   * Returns the name of the sqlite_vfs for the given database. Defaults to
   * `main`. Throws if this database is `close()`d.
   */
  dbVfsName(dbName?: string | number): string | undefined;

  /**
   * Creates a new scalar, aggregate, or window function which is accessible via
   * SQL code.
   *
   * When called from SQL, arguments to the UDF, and its result, will be
   * converted between JS and SQL with as much fidelity as is feasible,
   * triggering an exception if a type conversion cannot be determined. Some
   * freedom is afforded to numeric conversions due to friction between the JS
   * and C worlds: integers which are larger than 32 bits will be treated as
   * doubles or `BigInt` values.
   *
   * UDFs cannot currently be removed from a DB handle after they're added. More
   * correctly, they can be removed as documented for
   * `sqlite3_create_function_v2()`, but doing so will "leak" the JS-created
   * WASM binding of those functions.
   *
   * The first two call forms can only be used for creating scalar functions.
   * Creating an aggregate or window function requires the options-object form,
   * as described below.
   */
  createFunction(
    name: string,
    func: (ctxPtr: number, ...args: any[]) => SqlValue,
  ): this;
  createFunction(
    name: string,
    func: (ctxPtr: number, ...args: any[]) => void,
    options: FunctionOptions,
  ): this;
  createFunction(
    name: string,
    options:
      | ScalarFunctionOptions
      | AggregateFunctionOptions
      | WindowFunctionOptions,
  ): this;
  createFunction(
    options: (
      | ScalarFunctionOptions
      | AggregateFunctionOptions
      | WindowFunctionOptions
    ) & { name: string },
  ): this;

  /**
   * Prepares the given SQL, `step()`s it one time, and returns an array
   * containing the values of the first result row. If it has no results,
   * `undefined` is returned. If passed a second argument other than
   * `undefined`, it is treated like an argument to
   * {@link PreparedStatement#bind}, so may be any type supported by that
   * function. Throws on error.
   */
  selectArray(sql: FlexibleString, bind?: BindingSpec): SqlValue[] | undefined;

  /**
   * Runs the given SQL and returns an array of all results, with each row
   * represented as an array, as per the `'array'` `rowMode` option to
   * {@link Database#exec}. An empty result set resolves to an empty array. The
   * second argument, if any, is treated as the `bind` option to a call to
   * `exec()`. Throws on error.
   */
  selectArrays(sql: FlexibleString, bind?: BindingSpec): SqlValue[][];

  /**
   * Prepares the given SQL, `step()`s it one time, and returns an object
   * containing the key/value pairs of the first result row. If it has no
   * results, `undefined` is returned. Note that the order of returned object's
   * keys is not guaranteed to be the same as the order of the fields in the
   * query string. If passed a second argument other than undefined, it is
   * treated like an argument to Stmt.bind(), so may be any type supported by
   * that function. Throws on error.
   */
  selectObject(
    sql: FlexibleString,
    bind?: BindingSpec,
  ): { [columnName: string]: SqlValue } | undefined;

  /**
   * Works identically to {@link Database#selectArrays} except that each value in
   * the returned array is an object, as per the `"object"` rowMode option to
   * {@link Database#exec}.
   */
  selectObjects(
    sql: FlexibleString,
    bind?: BindingSpec,
  ): { [columnName: string]: SqlValue }[];

  /**
   * Prepares the given SQL, `step()`s the resulting {@link PreparedStatement}
   * one time, and returns the value of the first result column. If it has no
   * results, `undefined` is returned. If passed a second argument, it is
   * treated like an argument to {@link PreparedStatement#bind}, so may be any
   * type supported by that function. Passing the `undefined` value is the same
   * as passing no value, which is useful when... If passed a 3rd argument, it
   * is expected to be one of the `SQLITE_{typename}` constants. Passing the
   * `undefined` value is the same as not passing a value. Throws on error (e.g.
   * malformed SQL).
   */
  selectValue(
    sql: FlexibleString,
    bind: BindingSpec | undefined,
    asType: CAPI['SQLITE_INTEGER'] | CAPI['SQLITE_FLOAT'],
  ): number | undefined;
  selectValue(
    sql: FlexibleString,
    bind: BindingSpec | undefined,
    asType: CAPI['SQLITE_TEXT'],
  ): string | undefined;
  selectValue(
    sql: FlexibleString,
    bind: BindingSpec | undefined,
    asType: CAPI['SQLITE_BLOB'],
  ): Uint8Array | undefined;
  selectValue(
    sql: FlexibleString,
    bind: BindingSpec | undefined,
    asType: CAPI['SQLITE_NULL'],
  ): null | undefined;
  selectValue(sql: FlexibleString, bind?: BindingSpec): SqlValue | undefined;

  /**
   * Runs the given query and returns an array of the values from the first
   * result column of each row of the result set. The 2nd argument is an
   * optional value for use in a single-argument call to
   * {@link PreparedStatement#bind}. The 3rd argument may be any value suitable
   * for use as the 2nd argument to {@link  PreparedStatement#get}. If a 3rd
   * argument is desired but no bind data are needed, pass `undefined` for the
   * 2nd argument. If there are no result rows, an empty array is returned.
   */
  selectValues(
    sql: FlexibleString,
    bind?: BindingSpec,
    asType?: SQLiteDataType,
  ): SqlValue[];

  /**
   * Returns the number of currently-opened {@link PreparedStatement} handles for
   * this db handle, or 0 if this object is `close()`d. Note that only handles
   * prepared via {@link Database#prepare} are counted, and not handles prepared
   * using `capi.sqlite3_prepare_v3()` (or equivalent).
   */
  openStatementCount(): number;

  /**
   * Starts a transaction, calls the given `callback`, and then either rolls
   * back or commits the transaction, depending on whether the `callback`
   * throws. The `callback` is passed this object as its only argument. On
   * success, returns the result of the callback. Throws on error.
   *
   * Note that transactions may not be nested, so this will throw if it is
   * called recursively. For nested transactions, use the
   * {@link Database#savepoint} method or manually manage `SAVEPOINT`s using
   * {@link Database#exec}.
   *
   * If called with 2 arguments, the first must be a keyword which is legal
   * immediately after a `BEGIN` statement, e.g. one of `"DEFERRED"`,
   * `"IMMEDIATE"`, or `"EXCLUSIVE"`. Though the exact list of supported
   * keywords is not hard-coded here, in order to be future-compatible, if the
   * argument does not look like a single keyword then an exception is triggered
   * with a description of the problem.
   */
  transaction<T>(callback: (db: this) => T): T;
  transaction<T>(
    beginQualifier: 'DEFERRED' | 'IMMEDIATE' | 'EXCLUSIVE',
    callback: (db: this) => T,
  ): T;

  /**
   * This works similarly to {@link Database#transaction} but uses sqlite3's
   * `SAVEPOINT` feature. This function starts a savepoint (with an unspecified
   * name) and calls the given callback function, passing it this db object. If
   * the callback returns, the savepoint is released (committed). If the
   * callback throws, the savepoint is rolled back. If it does not throw, it
   * returns the result of the callback.
   */
  savepoint<T>(callback: (db: this) => T): T;

  /**
   * Expects to be given a `DatabaseApi` instance or an `sqlite3*` pointer (may
   * be `null`) and an sqlite3 API result code. If the result code is not falsy,
   * this function throws an `SQLite3Error` with an error message from
   * `sqlite3_errmsg()`, using the given db handle, or `sqlite3_errstr()` if the
   * db handle is falsy or is a `close()`ed DB instance. Note that if it's
   * passed a non-error code like `SQLITE_ROW` or `SQLITE_DONE`, it will still
   * throw but the error string might be `"Not an error."` The various non-0
   * non-error codes need to be checked for in client code where they are
   * expected. If it does not throw, it returns its `db` argument (`this`, if
   * called as a member function).
   */
  static checkRc: (
    db: Database | number | null,
    resultCode: number,
  ) => Database;

  /** Instance method version of {@link checkRc()}. */
  checkRc: (resultCode: number) => this;
}

/**
 * SQLite3 database backed by `localStorage` or `sessionStorage`.
 *
 * When the sqlite3 API is installed in the main thread, the this class is
 * added, which simplifies usage of the kvvfs.
 */
declare class JsStorageDb extends Database {
  /** Create a new kvvfs-backed database in local or session storage. */
  constructor(mode: 'local' | 'session');

  /** Returns an _estimate_ of how many bytes of storage are used by the kvvfs. */
  storageSize(): number;

  /**
   * Clears all kvvfs-owned state and returns the number of records it deleted
   * (one record per database page).
   */
  clearStorage(): number;
}

/**
 * SQLite3 database backed by the Origin Private File System API.
 *
 * Installed in the namespace only if OPFS VFS support is active.
 *
 * This support is only available when sqlite3.js is loaded from a Worker
 * thread, whether it's loaded in its own dedicated worker or in a worker
 * together with client code. This OPFS wrapper implements an `sqlite3_vfs`
 * wrapper entirely in JavaScript.
 *
 * This feature is activated automatically if the browser appears to have the
 * necessary APIs to support it. It can be tested for in JS code using one of:
 *
 *     If(sqlite3.capi.sqlite3_vfs_find("opfs")){ ... OPFS VFS is available ... }
 *     // Alternately: if(sqlite3.oo1.OpfsDb){ ... OPFS VFS is available ... }
 *
 * If it is available, the VFS named `"opfs"` can be used with any sqlite3 APIs
 * which accept a VFS name, such as `sqlite3_vfs_find()`,
 * `sqlite3_db_open_v2()`, and the `sqlite3.oo1.DB` constructor, noting that
 * {@link OpfsDb} is a convenience subclass of {@link Database} which
 * automatically uses this VFS. For URI-style names, use `file:my.db?vfs=opfs`.
 *
 * ## ⚠️Achtung: Safari versions < 17:
 *
 * Safari versions less than version 17 are incompatible with the current OPFS
 * VFS implementation because of a bug in storage handling from sub-workers.
 * There is no workaround for that - supporting it will require a separate VFS
 * implementation and we do not, as of July 2023, have an expected time frame
 * for its release. Both the `SharedAccessHandle` pool VFS and the WASMFS
 * support offers alternatives which should work with Safari versions 16.4 or
 * higher.
 *
 * ## ⚠️Achtung: COOP and COEP HTTP Headers
 *
 * In order to offer some level of transparent concurrent-db-access support,
 * JavaScript's SharedArrayBuffer type is required for the OPFS VFS, and that
 * class is only available if the web server includes the so-called COOP and
 * COEP response headers when delivering scripts:
 *
 *     Cross-Origin-Embedder-Policy: require-corp
 *     Cross-Origin-Opener-Policy: same-origin
 *
 * Without these headers, the `SharedArrayBuffer` will not be available, so the
 * OPFS VFS will not load. That class is required in order to coordinate
 * communication between the synchronous and asynchronous parts of the
 * `sqlite3_vfs` OPFS proxy.
 *
 * The COEP header may also have a value of `credentialless`, but whether or not
 * that will work in the context of any given application depends on how it uses
 * other remote assets.
 *
 * How to emit those headers depends on the underlying web server.
 */
declare class OpfsDatabase extends Database {
  /**
   * Creates a connection to the given file, optionally creating it if needed.
   *
   * @param filename The filename to open. Must be resolvable using whatever
   *   filesystem layer (virtual or otherwise) is set up for the default sqlite3
   *   VFS. Note that the special sqlite3 db names `":memory:"` and `""`
   *   (temporary db) have their normal special meanings here.
   * @param flags The flags to use when opening the file. It must be a string
   *   containing a sequence of letters (in any order, but case sensitive)
   *   specifying the mode:
   *
   *   - `c`: create if it does not exist, else fail if it does not exist. Implies
   *       the `w` flag. Will create all directorries leading up to the file.
   *   - `w`: write. Implies `r`: a db cannot be write-only.
   *   - `r`: read-only if neither `w` nor `c` are provided, else it is ignored.
   *   - `t`: enable tracing of SQL executed on this database handle, sending it to
   *       `console.log()`. To disable it later, call
   *       `sqlite3.capi.sqlite3_trace_v2(thisDb.pointer, 0, 0, 0)`. If `w` is
   *       not provided, the db is implicitly read-only, noting that `rc` is
   *       meaningless. Any other letters are currently ignored. The default is
   *       `c`. These modes are ignored for the special `":memory:"` and `""`
   *       names and may be ignored by specific VFSes.
   */
  constructor(filename: string, flags: string);

  /**
   * Import a database into OPFS storage. It only works with database files and
   * will throw if passed a different file type.
   */
  static importDb(
    filename: string,
    data: Uint8Array | ArrayBuffer,
  ): Promise<number>;
}

/** Exception class for reporting WASM-side allocation errors. */
declare class WasmAllocError extends Error {
  constructor(message: string);
  toss: any;
}

/** Exception class used primarily by the oo1 API. */
declare class SQLite3Error extends Error {
  constructor(message: string);
}

/** A pointer to a location in WASM heap memory. */
declare type WasmPointer = number;

declare type StructPtrMapper<T> = {
  StructType: T;
  /**
   * Creates a new StructType object, writes its `pointer` value to the given
   * output pointer, and returns that object. Its intended usage depends on
   * StructType:
   *
   * - `sqlite3_vtab`: to be called from `sqlite3_module::xConnect()` or
   *   `xCreate()` implementations.
   * - `sqlite3_vtab_cursor`: to be called from 1xOpen()`.
   *
   * This will throw if allocation of the `StructType` instance fails or if
   * `ppOut` is not a pointer-type value.
   */
  create: (ptr: WasmPointer) => T;

  /**
   * Returns the StructType object previously mapped to the given pointer using
   * `create()`. Its intended usage depends on `StructType`:
   *
   * - `sqlite3_vtab`: to be called from sqlite3_module methods which take a
   *   `(sqlite3_vtab*)` pointer _except_ for `xDestroy()`/`xDisconnect()`, in
   *   which case `unget()` or `dispose()`.
   * - `sqlite3_vtab_cursor`: to be called from any `sqlite3_module` methods which
   *   take a `sqlite3_vtab_cursor*` argument except `xClose()`, in which case
   *   use `unget()` or `dispose()`.
   *
   * Rule to remember: _never_ call `dispose()` on an instance returned by this
   * function.
   */
  get: (ptr: WasmPointer) => T;

  /**
   * Identical to get() but also disconnects the mapping between the given
   * pointer and the returned StructType object, such that future calls to this
   * function or get() with the same pointer will return the undefined value.
   * Its intended usage depends on StructType:
   *
   * - `sqlite3_vtab`: to be called from `sqlite3_module::xDisconnect()` or
   *   `xDestroy()` implementations or in error handling of a failed `xCreate()`
   *   or `xConnect()`.
   * - `sqlite3_vtab_cursor`: to be called from `xClose()` or during cleanup in a
   *   failed `xOpen()`.
   *
   * Calling this method obligates the caller to call `dispose()` on the
   * returned object when they're done with it.
   */
  unget: (ptr: WasmPointer, val: T) => void;

  /** Works like `unget()` plus it calls `dispose()` on the `StructType` object. */
  dispose: (ptr: WasmPointer) => void;
};

declare class SQLiteStruct {
  /**
   * Calling a constructor with no arguments creates a new instance in the WASM
   * heap in order to connect it to C. In this case, client JavaScript code owns
   * the memory for the instance unless some API explicitly takes it over.
   *
   * Passing a WASM pointer to the constructor creates a JS-level wrapper for an
   * existing instance of the struct (whether it comes from C or JS) without
   * taking over ownership of that memory. This permits JS to manipulate
   * instances created in C without taking over their memory.
   *
   * Both uses are fairly common, and they differ only in how they manage (or
   * not) the struct's memory.
   *
   * So long as a struct instance is active, its pointer property resolves to
   * its WASM heap memory address. That value can be passed to any C routines
   * which take pointers of that type. For example:
   *
   *     const m = new MyStruct();
   *     functionTakingMyStructPointers(m.pointer);
   */
  constructor(pointer?: WasmPointer);

  /** The WASM pointer to the struct. */
  pointer: WasmPointer;

  /**
   * When client code is finished with an instance, and no C-level code is using
   * its memory, the struct instance must be cleaned up by calling
   * theStruct.dispose(). Calling dispose() multiple times is harmless - calls
   * after the first are no-ops. Calling dipose() is not strictly required for
   * wrapped instances, as their WASM heap memory is owned elsewhere, but it is
   * good practice to call it because each instance may own memory other than
   * the struct memory.
   */
  dispose(): void;

  /**
   * If a given JS-side struct instance has a property named `ondispose`, that
   * property is used when `dispose()` is called in order to free up any
   * additional resources which may be associated with the struct (e.g.
   * C-allocated strings or other struct instances).
   *
   * `ondispose` is not set by default but may be set by the client to one of
   * the following:
   *
   * - If it's a function, it is called with no arguments and the being-disposed
   *   object as its this. It may perform arbitrary cleanup.
   * - If it's an array, each entry of the array may be any of:
   *
   *   - A function is called as described above.
   *   - Any JS-bound struct instance has its dispose() method called.
   *   - A number is assumed to be a WASM pointer, which gets freed using
   *       sqlite3.wasm.dealloc().
   *   - Any other value type is ignored. It is sometimes convenient to annotate the
   *       array with string entries to assist in understanding the code. For
   *       example:
   *
   *           X.ondispose = ['Wrapper for this.$next:', y];
   *
   * Any exceptions thrown by ondispose callbacks are ignored but may induce a
   * warning in the console.
   */
  ondispose?:
    | (() => void)
    | ((() => void) | SQLiteStruct | WasmPointer | string)[];

  /**
   * Client code may call `aStructInstance.addOnDispose()` to push one or more
   * arguments onto the disposal list. That function will create an `ondispose`
   * array if needed, or move a non-array `ondispose` value into a newly-created
   * `ondispose` array. It returns its `this`.
   */
  addOnDispose(val: (() => void) | SQLiteStruct | WasmPointer | string): this;

  /**
   * Overwrites (without freeing) any existing value in that member, replaces it
   * with a newly-allocated C-string, and stores that C-string in the instance's
   * ondispose state for cleanup when `dispose()` is called. The struct cannot
   * know whether it is safe to free such strings when overwriting them, so
   * instead adds each string set this way to the ondispose list.
   */
  setMemberCString(memberName: string, jsString: string): void;

  /**
   * Fetches the member's value. If it's `NULL`, `null` is returned, else it is
   * assumed to be a valid C-style string and a copy of it is returned as a JS
   * string.
   */
  memberToJsString(memberName: string): string | null;

  /** Returns true if the given member name is specifically tagged as a string. */
  memberIsString(memberName: string): boolean;

  /**
   * Installs a StructBinder-bound function pointer member of the given name and
   * function in this object.
   *
   * It creates a WASM proxy for the given function and arranges for that proxy
   * to be cleaned up when `this.dispose()` is called. Throws on the slightest
   * hint of error, e.g., the given name does not map to a struct-bound member.
   *
   * As a special case, if the given function is a pointer, then
   * `wasm.functionEntry()` is used to validate that it is a known function. If
   * so, it is used as-is with no extra level of proxying or cleanup, else an
   * exception is thrown. It is legal to pass a value of 0, indicating a `NULL`
   * pointer, with the caveat that 0 is a legal function pointer in WASM but it
   * will not be accepted as such here. (Justification: the function at address
   * zero must be one which initially came from the WASM module, not a method we
   * want to bind to client-level extension code.)
   *
   * This function returns a proxy for itself which is bound to `this` and takes
   * 2 args `(name,func)`. That function returns the same thing as this one,
   * permitting calls to be chained.
   *
   * If called with only 1 arg, it has no side effects but returns a func with
   * the same signature as described above.
   *
   * **⚠ACHTUNG:⚠** because we cannot generically know how to transform JS
   * exceptions into result codes, the installed functions do no automatic
   * catching of exceptions. It is critical, to avoid undefined behavior in the
   * C layer, that methods mapped via this function do not throw. The exception,
   * as it were, to that rule is...
   *
   * If `applyArgcCheck` is true then each JS function (as opposed to function
   * pointers) gets wrapped in a proxy which asserts that it is passed the
   * expected number of arguments, throwing if the argument count does not match
   * expectations. That is only intended for dev-time usage for sanity checking,
   * as exceptions passing through such methods will leave the C environment in
   * an undefined state.
   */
  installMethod(
    name: string,
    func: Function | WasmPointer,
    applyArgcCheck?: boolean,
  ): (name: string, func: Function | WasmPointer) => this;

  /** Behaves exactly like {@link SQLiteStruct#installMethods}. */
  installMethod(
    methodsObject: { [methodName: string]: Function },
    applyArgcCheck?: boolean,
  ): this;

  /**
   * Installs methods into this StructType-type instance. Each entry in the
   * given methods object must map to a known member of the given StructType,
   * else an exception will be triggered. See `installMethod()` for more
   * details, including the semantics of the second argument.
   *
   * As an exception to the above, if any two or more methods in the methods
   * object are the exact same function, `installMethod()` is not called for the
   * 2nd and subsequent instances, and instead those instances get assigned the
   * same method pointer which is created for the first instance. This
   * optimization is primarily to accommodate special handling of
   * `sqlite3_module::xConnect` and `xCreate` methods.
   *
   * On success, returns this object. Throws on error.
   */
  installMethods(
    methodsObject: { [methodName: string]: Function },
    applyArgcCheck?: boolean,
  ): this;
}

declare class sqlite3_vfs extends SQLiteStruct {
  iVersion: number;
  szOsFile: number;
  mxPathname: number;
  pNext: WasmPointer;
  zName: WasmPointer;
  pAppData: WasmPointer;

  constructor(pointer?: WasmPointer);
  xOpen: (
    vfsPtr: WasmPointer,
    zName: WasmPointer,
    file: WasmPointer,
    flags: number,
    pOutputFlags: WasmPointer,
  ) => number;
  xDelete: (vfsPtr: WasmPointer, zName: WasmPointer, syncDir: number) => number;
  xAccess: (
    vfsPtr: WasmPointer,
    zName: WasmPointer,
    flags: number,
    pResOut: WasmPointer,
  ) => number;
  xFullPathname: (
    vfsPtr: WasmPointer,
    zName: WasmPointer,
    nOut: number,
    zOut: WasmPointer,
  ) => number;
  xDlOpen: (vfsPtr: WasmPointer, zFilename: WasmPointer) => WasmPointer;
  xDlError: (vfsPtr: WasmPointer, nByte: number, zErrMsg: WasmPointer) => void;
  xDlSym: (
    vfsPtr: WasmPointer,
    pHandle: WasmPointer,
    zSymbol: WasmPointer,
  ) => WasmPointer;
  xDlClose: (vfsPtr: WasmPointer, pHandle: WasmPointer) => void;
  xRandomness: (
    vfsPtr: WasmPointer,
    nByte: number,
    zOut: WasmPointer,
  ) => number;
  xSleep: (vfsPtr: WasmPointer, microseconds: number) => number;
  xCurrentTime: (vfsPtr: WasmPointer, pTimeOut: WasmPointer) => number;
  xGetLastError: (vfsPtr: WasmPointer, nBuf: number, zBuf: WasmPointer) => void;
  xCurrentTimeInt64: (vfsPtr: WasmPointer, pTimeOut: WasmPointer) => number;
  xSetSystemCall: (
    vfsPtr: WasmPointer,
    zName: WasmPointer,
    pCall: WasmPointer,
  ) => number;
  xGetSystemCall: (
    vfsPtr: WasmPointer,
    zName: WasmPointer,
    pCall: WasmPointer,
  ) => WasmPointer;
  xNextSystemCall: (vfsPtr: WasmPointer, zName: WasmPointer) => WasmPointer;
}

declare class sqlite3_io_methods extends SQLiteStruct {
  iVersion: number;

  constructor(pointer?: WasmPointer);
  xClose: (file: WasmPointer) => number;
  xRead: (
    file: WasmPointer,
    buf: WasmPointer,
    iAmt: number,
    iOfst: number,
  ) => number;
  xWrite: (
    file: WasmPointer,
    buf: WasmPointer,
    iAmt: number,
    iOfst: number,
  ) => number;
  xTruncate: (file: WasmPointer, size: number) => number;
  xSync: (file: WasmPointer, flags: number) => number;
  xFileSize: (file: WasmPointer, pSize: WasmPointer) => number;
  xLock: (file: WasmPointer, lockType: number) => number;
  xUnlock: (file: WasmPointer, lockType: number) => number;
  xCheckReservedLock: (file: WasmPointer, pResOut: WasmPointer) => number;
  xFileControl: (file: WasmPointer, op: number, pArg: WasmPointer) => number;
  xSectorSize: (file: WasmPointer) => number;
  xDeviceCharacteristics: (file: WasmPointer) => number;
  xShmMap: (
    file: WasmPointer,
    iPg: number,
    pgsz: number,
    bExtend: number,
    pp: WasmPointer,
  ) => number;
  xShmLock: (
    file: WasmPointer,
    offset: number,
    n: number,
    flags: number,
  ) => number;
  xShmBarrier: (file: WasmPointer) => void;
  xShmUnmap: (file: WasmPointer, deleteFlag: number) => number;
  xFetch: (
    file: WasmPointer,
    iOfst: number,
    iAmt: number,
    pp: WasmPointer,
  ) => number;
  xUnfetch: (file: WasmPointer, iOfst: number, p: WasmPointer) => number;
}

declare class sqlite3_file extends SQLiteStruct {
  pMethods: WasmPointer;

  constructor(pointer?: WasmPointer);
}

declare class sqlite3_vtab extends SQLiteStruct {
  pModule: WasmPointer;
  nRef: number;
  zErrMsg: WasmPointer;

  constructor(pointer?: WasmPointer);
}

declare class sqlite3_vtab_cursor extends SQLiteStruct {
  pVtab: WasmPointer;

  constructor(pointer?: WasmPointer);
}

declare class sqlite3_module extends SQLiteStruct {
  iVersion: number;

  constructor(pointer?: WasmPointer);
  xCreate: (
    db: WasmPointer,
    pAux: WasmPointer,
    argc: number,
    argv: WasmPointer,
    ppVtab: WasmPointer,
    pzErr: WasmPointer,
  ) => number;
  xConnect: (
    db: WasmPointer,
    pAux: WasmPointer,
    argc: number,
    argv: WasmPointer,
    ppVtab: WasmPointer,
    pzErr: WasmPointer,
  ) => number;
  xBestIndex: (
    pVtab: WasmPointer,
    pIndexInfo: WasmPointer,
    pp: WasmPointer,
    pCost: WasmPointer,
  ) => number;
  xDisconnect: (pVtab: WasmPointer) => number;
  xDestroy: (pVtab: WasmPointer) => number;
  xOpen: (pVtab: WasmPointer, ppCursor: WasmPointer) => number;
  xClose: (pCursor: WasmPointer) => number;
  xFilter: (
    pCursor: WasmPointer,
    idxNum: number,
    idxStr: WasmPointer,
    argc: number,
    argv: WasmPointer,
  ) => number;
  xNext: (pCursor: WasmPointer) => number;
  xEof: (pCursor: WasmPointer) => number;
  xColumn: (pCursor: WasmPointer, pContext: WasmPointer, i: number) => number;
  xRowid: (pCursor: WasmPointer, pRowid: WasmPointer) => number;
  xUpdate: (
    pVtab: WasmPointer,
    argc: number,
    argv: WasmPointer,
    pRowid: WasmPointer,
  ) => number;
  xBegin: (pVtab: WasmPointer) => number;
  xSync: (pVtab: WasmPointer) => number;
  xCommit: (pVtab: WasmPointer) => number;
  xRollback: (pVtab: WasmPointer) => number;
  xFindFunction: (
    pVtab: WasmPointer,
    nArg: number,
    zName: WasmPointer,
    pxFunc: WasmPointer,
    ppArg: WasmPointer,
  ) => number;
  xRename: (pVtab: WasmPointer, zNew: WasmPointer) => number;
  xSavepoint: (pVtab: WasmPointer, iSavepoint: number) => number;
  xRelease: (pVtab: WasmPointer, iSavepoint: number) => number;
  xRollbackTo: (pVtab: WasmPointer, iSavepoint: number) => number;
  xShadowName: (tableName: WasmPointer) => number;
}

declare class sqlite3_index_constraint extends SQLiteStruct {
  iColumn: number;
  op: number;
  usable: number;
  iTermOffset: number;

  constructor(pointer?: WasmPointer);
}

declare class sqlite3_index_constraint_usage extends SQLiteStruct {
  argvIndex: number;
  omit: number;

  constructor(pointer?: WasmPointer);
}

declare class sqlite3_index_orderby extends SQLiteStruct {
  iColumn: number;
  desc: number;

  constructor(pointer?: WasmPointer);
}

declare class sqlite3_index_info extends SQLiteStruct {
  nConstraint: number;
  aConstraint: WasmPointer;
  nOrderBy: number;
  aOrderBy: WasmPointer;
  aConstraintUsage: WasmPointer;
  idxNum: number;
  idxStr: WasmPointer;
  needToFreeIdxStr: number;
  orderByConsumed: number;
  estimatedCost: number;
  estimatedRows: BigInt;
  idxFlags: number;
  colUsed: BigInt;
  sqlite3_index_constraint: sqlite3_index_constraint;
  sqlite3_index_orderby: sqlite3_index_orderby;
  sqlite3_index_constraint_usage: sqlite3_index_constraint_usage;

  constructor(pointer?: WasmPointer);
}

declare type Sqlite3Static = {
  /** The namespace for the C-style APIs. */
  capi: CAPI;

  /**
   * WASM-specific utilities, abstracted to be independent of, and configurable
   * for use with, arbitrary WASM runtime environments.
   */
  wasm: WASM_API;

  /** The OO API #1. */
  oo1: {
    OpfsDb: typeof OpfsDatabase;
    JsStorageDb: typeof JsStorageDb;
    DB: typeof Database;
  };

  /**
   * Initializes the Worker API.
   *
   * Required to to permit this API to be loaded in Worker threads without
   * automatically registering onmessage handlers
   *
   * If this function is called from a non-worker thread then it throws an
   * exception. It must only be called once per Worker.
   */
  initWorker1API(): void;

  WasmAllocError: WasmAllocError;

  SQLite3Error: SQLite3Error;

  /**
   * The options with which the API was configured. Whether or not modifying
   * them after the bootstrapping process will have any useful effect is
   * unspecified and may change with any given version. Clients must not rely on
   * that capability.
   */
  config: {
    exports: any;
    memory: WebAssembly.Memory;
    bigIntEnabled: boolean;
    debug: typeof console.debug;
    warn: typeof console.warn;
    error: typeof console.error;
    log: typeof console.log;
    wasmOpfsDir: string;
    useStdAlloc: boolean;
    allocExportName: string;
    deallocExportName: string;
    reallocExportName: string;
  };

  /**
   * The library reserves this property for client-side use and promises to
   * never define a property with this name nor to ever rely on specific
   * contents of it. It makes no such guarantees for other properties.
   */
  client: any;

  /* Utility code for creating sqlite3_vfs's. */
  vfs: {
    /**
     * A wrapper for installMethods() or registerVfs() to reduce installation of
     * a VFS and/or its I/O methods to a single call.
     *
     * Accepts an object which contains the properties `"io"` and/or `"vfs"`,
     * each of which is itself an object with following properties:
     *
     * - `struct`: an `sqlite3.StructType`-type struct. This must be a populated
     *   (except for the methods) object of type `sqlite3_io_methods` (for the
     *   `"io"` entry) or `sqlite3_vfs` (for the `"vfs"` entry).
     * - `methods`: an object mapping `sqlite3_io_methods` method names (e.g.
     *   `'xClose'`) to JS implementations of those methods. The JS
     *   implementations must be call-compatible with their native
     *   counterparts.
     *
     * For each of those object, this function passes its (`struct`, `methods`,
     * (optional) `applyArgcCheck`) properties to `installMethods()`.
     *
     * If the `vfs` entry is set then:
     *
     * - Its `struct` property's `registerVfs()` is called. The `vfs` entry may
     *   optionally have an `asDefault` property, which gets passed as the
     *   argument to `registerVfs()`.
     * - If `struct.$zName` is falsy and the entry has a string-type `name`
     *   property, `struct.$zName` is set to the C-string form of that `name`
     *   value before `registerVfs()` is called. That string gets added to the
     *   on-dispose state of the struct.
     *
     * On success returns this object. Throws on error.
     */
    installVfs: (obj: {
      io?: {
        struct: sqlite3_io_methods;
        methods: Omit<sqlite3_io_methods, 'iVersion'>;
      };
    }) => Sqlite3Static['vfs'];
  };

  /** Utility code for creating virtual table implementations. */
  vtab: {
    /**
     * A lifetime-management object for mapping `sqlite3_vtab*` instances in
     * `sqlite3_module` methods to `capi.sqlite3_vtab` objects.
     */
    xVtab: StructPtrMapper<sqlite3_vtab>;

    /**
     * A lifetime-management object for mapping `sqlite3_vtab_cursor*` instances
     * in sqlite3_module methods to `capi.sqlite3_vtab_cursor` objects.
     */
    xCursor: StructPtrMapper<sqlite3_vtab_cursor>;

    /**
     * Convenience form of creating an `sqlite3_index_info` wrapper, intended
     * for use in `xBestIndex` implementations. Note that the caller is expected
     * to call `dispose()` on the returned object before returning. Though not
     * _strictly_ required, as that object does not own the `pIdxInfo` memory,
     * it is nonetheless good form.
     */
    xIndexInfo: (pIdxInfo: WasmPointer) => sqlite3_index_info;

    /**
     * Given an `sqlite3_module` method name and error object, this function
     * returns `sqlite3.capi.SQLITE_NOMEM` if `(e instanceof
     * sqlite3.WasmAllocError)`, else it returns its second argument. Its
     * intended usage is in the methods of a `sqlite3_vfs` or `sqlite3_module`:
     *
     *     try{
     *      let rc = ...
     *      return rc;
     *     }catch(e){
     *       return sqlite3.vtab.xError(
     *                'xColumn', e, sqlite3.capi.SQLITE_XYZ);
     *       // where SQLITE_XYZ is some call-appropriate result code.
     *     }
     *
     * If no 3rd argument is provided, its default depends on the error type:
     *
     * - An `sqlite3.WasmAllocError` always resolves to `capi.SQLITE_NOMEM`.
     * - If `err` is an SQLite3Error then its `resultCode` property is used.
     * - If all else fails, `capi.SQLITE_ERROR` is used.
     *
     * If `xError.errorReporter` is a function, it is called in order to report
     * the error, else the error is not reported. If that function throws, that
     * exception is ignored.
     */
    xError: ((methodName: string, err: Error, defaultRc: number) => number) & {
      errorReporter?: (errorStr: string) => void;
    };

    /**
     * A helper for `sqlite3_vtab::xRowid()` and `xUpdate()` implementations. It
     * must be passed the final argument to one of those methods (an output
     * pointer to an int64 row ID) and the value to store at the output
     * pointer's address. Returns the same as `wasm.poke()` and will throw if
     * the 1st or 2nd arguments are invalid for that function.
     *
     * Example `xRowid` impl:
     *
     *     const xRowid = (pCursor, ppRowid64) => {
     *       const c = vtab.xCursor(pCursor);
     *       vtab.xRowid(ppRowid64, c.myRowId);
     *       return 0;
     *     };
     */
    xRowid: (ppRowId64: WasmPointer, value: number) => WASM_API;

    /**
     * A helper to initialize and set up an `sqlite3_module` object for later
     * installation into individual databases using `sqlite3_create_module()`.
     *
     * If `catchExceptions` is false, it is up to the client to ensure that no
     * exceptions escape the methods, as doing so would move them through the C
     * API, leading to undefined behavior. (vtab.xError() is intended to assist
     * in reporting such exceptions.)
     *
     * This is to facilitate creation of those methods inline in the passed-in
     * object without requiring the client to explicitly get a reference to one
     * of them in order to assign it to the other one.
     *
     * The `catchExceptions`-installed handlers will account for identical
     * references to the above functions and will install the same wrapper
     * function for both.
     *
     * The given methods are expected to return integer values, as expected by
     * the C API. If `catchExceptions` is truthy, the return value of the
     * wrapped function will be used as-is and will be translated to 0 if the
     * function returns a falsy value (e.g. if it does not have an explicit
     * return). If `catchExceptions` is _not_ active, the method implementations
     * must explicitly return integer values.
     *
     * Throws on error. On success, returns the sqlite3_module object (`this` or
     * `opt.struct` or a new sqlite3_module instance, depending on how it's
     * called).
     */
    setupModule: {
      /**
       * An object containing a mapping of properties with the C-side names of
       * the sqlite3_module methods, e.g. `xCreate`, `xBestIndex`, etc., to JS
       * implementations for those functions.
       *
       * Certain methods may refer to the same implementation. To simplify the
       * definition of such methods:
       *
       * - If `methods.xConnect` is `true` then the value of `methods.xCreate` is
       *   used in its place, and vice versa. sqlite treats xConnect/xCreate
       *   functions specially if they are exactly the same function (same
       *   pointer value).
       * - If `methods.xDisconnect` is true then the value of `methods.xDestroy`
       *   is used in its place, and vice versa.
       */
      methods: Omit<sqlite3_module, 'iVersion'> &
        (
          | {
              xConnect: undefined;
            }
          | { xCreate: undefined }
        ) &
        (
          | {
              xDisconnect: undefined;
            }
          | { xDestroy: undefined }
        );

      /**
       * (default=false): if truthy, the given methods are not mapped as-is, but
       * are instead wrapped inside wrappers which translate exceptions into
       * result codes of SQLITE_ERROR or SQLITE_NOMEM, depending on whether the
       * exception is an sqlite3.WasmAllocError. In the case of the xConnect and
       * xCreate methods, the exception handler also sets the output error
       * string to the exception's error string.
       */
      catchExceptions?: boolean;

      /**
       * A `sqlite3.capi.sqlite3_module()` instance. If not set, one will be
       * created automatically. If the current `"this"` is-a `sqlite3_module`
       * then it is unconditionally used in place of `struct`.
       */
      struct?: sqlite3_module;

      /**
       * If set, it must be an integer value and it gets assigned to the
       * `$iVersion` member of the struct object. If it's _not_ set, and the
       * passed-in `struct` object's `$iVersion` is 0 (the default) then this
       * function attempts to define a value for that property based on the list
       * of methods it has.
       */
      iVersion?: number;
    };
  };
};

declare type InitOptions = {
  locateFile?: (path: string, prefix: string) => string;
  print?: (msg: string) => void;
  printErr?: (msg: string) => void;
};

/**
 * A function installed by Emscripten to load and initialize the module. It
 * accepts an optional object to act as the so-called Emscripten Module, with
 * which the client may be notified of loading progress an errors.
 *
 * See the [Emscripten docs on the topic][1] for full details.
 *
 * Note that this project has no influence over those options and the Emscripten
 * project may change them at any time, so we neither document nor support them.
 * Note, also, that this project may attempt to internally override any specific
 * option, potentially leading to undesired side effects if client code does the
 * same.
 *
 * [1] https://emscripten.org/docs/api_reference/module.html
 */
export default function init(opts?: InitOptions): Promise<Sqlite3Static>;

declare type ListLike<T> = {
  length: number;
  forEach: (cb: (val: T) => void) => void;
};

declare type WASM_API = {
  /**
   * The `sqlite3.wasm.exports` namespace object is a WASM-standard part of the
   * WASM module file and contains all "exported" C functions which are built
   * into the WASM module, as well as certain non-function values which are part
   * of the WASM module. The functions which live in this object are as
   * low-level as it gets, in terms of JS/C bindings. They perform no automatic
   * type conversions on their arguments or result values and many, perhaps
   * most, are cumbersome to use from JS because of that. This level of the API
   * is not generally recommended for client use but is available for those who
   * want to make use of it. The functions in this object which are intended for
   * client-side use are re-exported into the {@link CAPI} namespace and have
   * automatic type conversions applied to them (where applicable). Some small
   * handful of the functions get re-exported into the {@link WASM_API}
   * namespace.
   */
  exports: any;

  /* ==========================================================================
   * Memory Management
   * ==========================================================================
   * Just like in C, WASM offers a memory "heap," and transfering values
   * between JS and WASM often requires manipulation of that memory, including
   * low-level allocation and deallocation of it. The following subsections
   * describe the various memory management APIs.
   */

  /* --------------------------------------------------------------------------
   * Low-level Management
   * --------------------------------------------------------------------------
   * The lowest-level memory management works like C's standard `malloc()`,
   * `realloc()`, and `free()`, the one difference being that exceptions are used
   * for reporting out-of-memory conditions. In order to avoid certain API
   * misuses caused by mixing different allocators, the canonical sqlite3.js
   * builds wrap `sqlite3_malloc()`, `sqlite3_realloc()`, and `sqlite3_free()`
   * instead of `malloc()`, `realloc()`, and `free()`, but the semantics of both
   * pairs are effectively identical.
   */

  /**
   * Allocates n bytes of memory from the WASM heap and returns the address of
   * the first byte in the block. `alloc()` throws a {@link WasmAllocError} if
   * allocation fails. If non-thowing allocation is required, use
   * {@link WASM_API#alloc.impl}, which returns a WASM NULL pointer (the integer
   * 0) if allocation fails.
   *
   * Note that memory allocated this way is not automatically zeroed out. In
   * practice that has not proven to be a problem (in JS, at least) because
   * memory is only explicitly allocated when it has a specific use and will be
   * populated by the code which allocates it.
   */
  alloc: ((numBytes: number) => WasmPointer) & {
    impl: (numBytes: number) => WasmPointer;
  };

  /**
   * Uses {@link WASM_API#alloc} to allocate enough memory for the byte-length of
   * the given JS string, plus 1 (for a `NUL` terminator), copies the given JS
   * string to that memory using `jstrcpy()`, `NUL`-terminates it, and returns
   * the pointer to that C-string. Ownership of the pointer is transfered to the
   * caller, who must eventually pass the pointer to {@link WASM_API#dealloc} to
   * free it.
   *
   * If passed a truthy 2nd argument then its return semantics change: it
   * returns `[ptr,n]`, where `ptr` is the C-string's pointer and n is its
   * cstrlen().
   */
  allocCString(
    jsString: string,
    returnPtrAndLength: undefined | false,
  ): WasmPointer;
  allocCString(
    jsString: string,
    returnPtrAndLength: true,
  ): [WasmPointer, number];

  /**
   * Creates a C-style array, using `alloc()`, suitable for passing to a C-level
   * `main()` routine. The input is a collection with a `length` property and a
   * `forEach()` method. A block of memory `list.length` entries long is
   * allocated and each pointer-sized block of that memory is populated with the
   * `allocCString()` conversion of the `(''+value)` of each element. Returns a
   * pointer to the start of the list, suitable for passing as the 2nd argument
   * to a C-style `main()` function.
   *
   * Throws if `list.length` is falsy.
   *
   * Note that the returned value is troublesome to deallocate but it is
   * intended for use with calling a C-level `main()` function, where the
   * strings must live as long as the application. See `scopedAllocMainArgv()`
   * for a variant which is trivial to deallocate.
   */
  allocMainArgv: (list: ListLike<{ toString(): string }>) => WasmPointer;

  /**
   * Allocates one or more pointers as a single chunk of memory and zeroes them
   * out.
   *
   * The first argument is the number of pointers to allocate. The second
   * specifies whether they should use a "safe" pointer size (8 bytes) or
   * whether they may use the default pointer size (typically 4 but also
   * possibly 8).
   *
   * How the result is returned depends on its first argument: if passed 1, it
   * returns the allocated memory address. If passed more than one then an array
   * of pointer addresses is returned, which can optionally be used with
   * "destructuring assignment" like this:
   *
   *     Const[(p1, p2, p3)] = allocPtr(3);
   *
   * **ACHTUNG:** when freeing the memory, pass only the first result value to
   * `dealloc()`. The others are part of the same memory chunk and must not be
   * freed separately.
   *
   * The reason for the 2nd argument is...
   *
   * When one of the returned pointers will refer to a 64-bit value, e.g. a
   * `double` or `int64`, and that value must be written or fetched, e.g. using
   * `poke()` or `peek()`, it is important that the pointer in question be
   * aligned to an 8-byte boundary or else it will not be fetched or written
   * properly and will corrupt or read neighboring memory. It is only safe to
   * pass false when the client code is certain that it will only get/fetch
   * 4-byte values (or smaller).
   */
  allocPtr(howMany: 1 | undefined, safePtrSize?: boolean): WasmPointer;
  allocPtr(howMany: number, safePtrSize?: boolean): WasmPointer[];

  /**
   * Frees memory returned by `alloc()`. Results are undefined if it is passed
   * any value other than a value returned by `alloc()` or
   * `null`/`undefined`/`0` (all of which are no-ops).
   */
  dealloc: (ptr: WasmPointer) => void;

  /**
   * Semantically equivalent to `realloc(3)` or `sqlite3_realloc()`, this
   * routine reallocates memory allocated via this routine or `alloc()`. Its
   * first argument is either 0 or a pointer returned by this routine or
   * `alloc()`. Its second argument is the number of bytes to (re)allocate, or 0
   * to free the memory specified in the first argument. On allocation error,
   * `realloc()` throws a `WasmAllocError`, whereas `realloc.impl()` will return
   * `0` on allocation error.
   *
   * Beware that reassigning the return value of `realloc.impl()` is poor
   * practice and can lead to leaks of heap memory:
   *
   *     Let m = wasm.realloc(0, 10); // allocate 10 bytes m =
   *     wasm.realloc.impl(m, 20); // grow m to 20 bytes
   *
   * If that reallocation fails, it will return 0, overwriting `m` and
   * effectively leaking the first allocation.
   */
  realloc: ((ptr: WasmPointer, numBytes: number) => WasmPointer) & {
    impl: (ptr: WasmPointer, numBytes: number) => WasmPointer;
  };

  /**
   * For the given IR-like string in the set ('i8', 'i16', 'i32', 'f32',
   * 'float', 'i64', 'f64', 'double', '_'), or any string value ending in '_',
   * returns the sizeof for that value (wasm.ptrSizeof in the latter case). For
   * any other value, it returns the undefined value.
   *
   * Some allocation routines use this enable callers to pass them an IR value
   * instead of an integer.
   */
  sizeofIR: (
    irStr:
      | 'i8'
      | 'i16'
      | 'i32'
      | 'f32'
      | 'float'
      | 'i64'
      | 'f64'
      | 'double'
      | '_'
      | string,
  ) => number;

  /* --------------------------------------------------------------------------
   * "Scoped" Allocation Management
   * --------------------------------------------------------------------------
   *
   * It is often convenient to manage allocations in such a way that all
   * allocations made in a particular block are "automatically" cleaned up
   * when that block exits. This API provides "scoped" allocation routines
   * which work this way.
   */

  /**
   * Opens a new "scope" for allocations. All allocations made via the
   * `scopedAllocXyz()` APIs will store their results into the current (most
   * recently pushed) allocation scope for later cleanup. The returned value
   * must be retained for passing to `scopedAllocPop()`.
   *
   * Any number of scopes may be active at once, but they must be popped in
   * reverse order of their creation. i.e. they must nest in a manner equivalent
   * to C-style scopes.
   *
   * **Warnings:**
   *
   * - All of the other `scopedAllocXyz()` routines will throw if no scope is
   *   active.
   * - It is never legal to pass the result of a scoped allocation to `dealloc()`,
   *   and doing so will cause a double-free when the scope is closed with
   *   `scopedAllocPop()`.
   *
   * This function and its relatives have only a single intended usage pattern:
   *
   *     Const scope = wasm.scopedAllocPush();
   *     try {
   *         ... use scopedAllocXyz() routines ...
   *         // It is perfectly legal to use non-scoped allocations here,
   *         // they just won't be cleaned up when...
   *     } finally {
   *         wasm.scopedAllocPop(scope);
   *     }
   */
  scopedAllocPush: () => WasmPointer;

  /**
   * Works just like `alloc(n)` but stores the result of the allocation in the
   * current scope.
   *
   * This function's read-only `level` property resolves to the current
   * allocation scope dep
   */
  scopedAlloc: ((numBytes: number) => WasmPointer) & { level: number };

  /**
   * This functions exactly like `allocMainArgv()` but is scoped to the current
   * allocation scope and its contents will be freed when the current allocation
   * scoped is popped.
   */
  scopedAllocMainArgv: (list: ListLike<{ toString(): string }>) => WasmPointer;

  /**
   * Calls `scopedAllocPush()`, calls the given `callback`, and then calls
   * `scopedAllocPop()`, propagating any exception from the callback or
   * returning its result. This is essentially a convenience form of:
   *
   *     const scope = wasm.scopedAllocPush();
   *     try {
   *       return callback();
   *     } finally {
   *       wasm.scopedAllocPop(scope);
   *     }
   */
  scopedAllocCall: <T>(callback: () => T) => T;

  /**
   * Works just like `allocCString()` but stores the result of the allocation in
   * the current scope.
   */
  scopedAllocCString(
    jsString: string,
    returnWithLength: undefined | false,
  ): WasmPointer;
  scopedAllocCString(
    jsString: string,
    returnPtrAndLength: true,
  ): [WasmPointer, number];

  /**
   * Works just like `allocPtr()` but stores the result of the allocation in the
   * current scope.
   */
  scopedAllocPt(howMany: 1 | undefined, safePtrSize?: boolean): WasmPointer;
  scopedAllocPtr(howMany: number, safePtrSize?: boolean): WasmPointer[];

  /**
   * Given a value returned from `scopedAllocPush()`, this "pops" that
   * allocation scope and frees all memory allocated in that scope by the
   * `scopedAllocXyz()` family of APIs.
   *
   * It is technically legal to call this without any argument, but passing an
   * argument allows the allocator to perform sanity checking to ensure that
   * scopes are pushed and popped in the proper order (it throws if they are
   * not). Failing to pass an argument is not illegal but will make that sanity
   * check impossible.
   */
  scopedAllocPop: (opaque: WasmPointer) => void;

  /* --------------------------------------------------------------------------
     * "PStack" Allocation
     * --------------------------------------------------------------------------
     * The "pstack" (pseudo-stack) API is a special-purpose allocator intended
     * solely for use with allocating small amounts of memory such as that
     * needed for output pointers. It is more efficient than the scoped
     * allocation API, and covers many of the use cases for that API, but it has
     * a tiny static memory limit (with an unspecified total size no less than
     * 4kb).

     * The pstack API is typically used like:
     *
     *    const pstack = sqlite3.wasm.pstack;
     *    const stackPtr = pstack.pointer;
     *    try {
     *       const ptr = pstack.alloc(8);
     *       // ==> pstack.pointer === ptr
     *       const otherPtr = pstack.alloc(8);
     *       // ==> pstack.pointer === otherPtr
     *       ...
     *    } finally {
     *       pstack.restore(stackPtr);
     *       // ==> pstack.pointer === stackPtr
     *    }
     */
  pstack: {
    /**
     * Attempts to allocate the given number of bytes from the pstack. On
     * success, it zeroes out a block of memory of the given size, adjusts the
     * pstack pointer, and returns a pointer to the memory. On error, returns
     * throws a `WasmAllocError`. The memory must eventually be released using
     * `pstack.restore()`.
     *
     * The `n` may be a string accepted by `wasm.sizeofIR()`, and any string
     * value not accepted by that function will trigger a `WasmAllocError`
     * exception.
     *
     * This method always adjusts the given value to be a multiple of 8 bytes
     * because failing to do so can lead to incorrect results when reading and
     * writing 64-bit values from/to the WASM heap. Similarly, the returned
     * address is always 8-byte aligned.
     */
    alloc: (n: number | string) => WasmPointer;

    /**
     * `Alloc()`'s `n` chunks, each `sz` bytes, as a single memory block and
     * returns the addresses as an array of `n` element, each holding the
     * address of one chunk.
     *
     * The `sz` argument may be a string value accepted by `wasm.sizeofIR()`,
     * and any string value not accepted by that function will trigger a
     * `WasmAllocError` exception.
     *
     * Throws a `WasmAllocError` if allocation fails.
     *
     * Example:
     *
     *     Const[(p1, p2, p3)] = pstack.allocChunks(3, 4);
     */
    allocChunks: (n: number, sz: number | string) => WasmPointer[];

    /**
     * A convenience wrapper for `allocChunks()` which sizes each chunk as
     * either 8 bytes (`safePtrSize` is truthy) or `wasm.ptrSizeof` (if
     * `safePtrSize` is falsy).
     *
     * How it returns its result differs depending on its first argument: if
     * it's 1, it returns a single pointer value. If it's more than 1, it
     * returns the same as `allocChunks()`.
     *
     * When any returned pointers will refer to a 64-bit value, e.g. a double or
     * int64, and that value must be written or fetched, e.g. using
     * `wasm.poke()` or `wasm.peek()`, it is important that the pointer in
     * question be aligned to an 8-byte boundary or else it will not be fetched
     * or written properly and will corrupt or read neighboring memory.
     *
     * However, when all pointers involved point to "small" data, it is safe to
     * pass a falsy value to save a tiny bit of memory.
     */
    allocPtr(howMany?: 1 | undefined, safePtrSize?: boolean): WasmPointer;
    allocPtr(howMany: number, safePtrSize?: boolean): WasmPointer[];

    /**
     * This property resolves to the current pstack position pointer. This value
     * is intended only to be saved for passing to `restore()`. Writing to this
     * memory, without first reserving it via `pstack.alloc()` (or equivalent)
     * leads to undefined results.
     */
    pointer: WasmPointer;

    /**
     * This property resolves to the total number of bytes available in the
     * pstack, including any space which is currently allocated. This value is a
     * compile-time constant.unknown
     */
    quota: number;

    /** This property resolves to the amount of space remaining in the pstack. */
    remaining: number;

    /**
     * Sets the current pstack position to the given pointer. Results are
     * `undefined` if the passed-in value did not come from `pstack.pointer` or
     * if memory allocated in the space before the given pointer are used after
     * this call.
     */
    restore: (pstackptr: WasmPointer) => void;
  };

  /* --------------------------------------------------------------------------
   * Getting/Setting Memory Values
   * --------------------------------------------------------------------------
   *
   * The WASM memory heap is exposed to JS as a byte array of memory which is
   * made to appear contiguous (though it's really allocated in chunks). Given
   * a byte-oriented view of the heap, it is possible to read and write
   * individual bytes of the heap, just like in C:
   *
   *    const X = wasm.heap8u(); // a uint8-oriented view of the heap
   *    X[someAddress] = 0x2a;
   *    console.log( X[someAddress] ); // ==> 42
   *
   * Obviously, writing arbitrary addresses can corrupt the WASM heap, just like in
   * C, so one has to be careful with the memory addresses the work with (just like
   * in C!).
   *
   *  Tip: it is important never to hold on to objects returned from methods
   *  like `heap8u()` long-term, as they may be invalidated if the heap grows.
   *  It is acceptable to hold the reference for a brief series of calls, so
   *  long as those calls are guaranteed not to allocate memory on the WASM
   *  heap, but it should never be cached for later use.
   *
   * Before describing the routines for manipulating the heap, we first need
   * to look at data type descriptors, sometimes referred to as "IR" (internal
   * representation). These are short strings which identify the specific data
   * types supported by WASM and/or the JS/WASM glue code:
   *
   * - `i8`: 8-bit signed integer
   * - `i16`: 16-bit signed integer
   * - `i32`: 32-bit signed integer. Aliases: `int`, `*`, `**` (noting that
   *    `*` and `**` may be remapped dynamically to to i64 when WASM environments
   *    gain 64-bit pointer capabilities).
   * - `i64`: 64-bit signed integer. APIs which use this require that the
   *    application has been built with BigInt support, and will throw if that is
   *    not the case.
   * - `f32`: 32-bit floating point value. Alias: float
   * - `f64`: 64-bit floating point value. Alias: double
   *
   * These are used extensively by the memory accessor APIs and need to be
   * committed to memory.
   */

  /**
   * The first form fetches a single value from memory. The second form fetches
   * the value from each pointer in the given array and returns the array of
   * values. The heap view used for reading the memory is specified by the
   * second argument, defaulting to byte-oriented view.
   *
   * If the 2nd argument ends with `"*"` then the pointer-sized representation
   * is always used (currently always 32 bits).
   */
  peek(addr: WasmPointer, representation?: string): number;
  peek(addrs: WasmPointer[], representation?: string): number[];

  /**
   * Equivalent to `peek(X,'*')`. Most frequently used for fetching output
   * pointer values.
   */
  peekPtr: (addr: WasmPointer) => number;

  /** Equivalent to peek(X,'i8') */
  peek8: (addr: WasmPointer) => number;

  /** Equivalent to peek(X,'i16') */
  peek16: (addr: WasmPointer) => number;

  /** Equivalent to peek(X,'i32') */
  peek32: (addr: WasmPointer) => number;

  /**
   * Equivalent to peek(X,'i64'). Will throw if the environment is not
   * configured with BigInt support.
   */
  peek64: (addr: WasmPointer) => BigInt;

  /** Equivalent to peek(X,'f32') */
  peek32f: (addr: WasmPointer) => number;

  /** Equivalent to peek(X,'f64') */
  peek64f: (addr: WasmPointer) => number;

  /**
   * Requires `n` to be one of:
   *
   * - Integer 8, 16, or 32.
   * - A integer-type TypedArray constructor: `Int8Array`, `Int16Array`,
   *   `Int32Array`, or their `Uint` counterparts.
   *
   * If `BigInt` support is enabled, it also accepts the value 64 or a
   * `BigInt64Array`/`BigUint64Array`, else it throws if passed 64 or one of
   * those constructors.
   *
   * Returns an integer-based `TypedArray` view of the WASM heap memory buffer
   * associated with the given block size. If passed an integer as the first
   * argument and unsigned is truthy then the `"U"` (unsigned) variant of that
   * view is returned, else the signed variant is returned. If passed a
   * `TypedArray` value, the 2nd argument is ignored. Note that `Float32Array`
   * and `Float64Array` views are not supported by this function.
   *
   * Be aware that growth of the heap may invalidate any references to this
   * heap, so do not hold a reference longer than needed and do not use a
   * reference after any operation which may allocate. Instead, re-fetch the
   * reference by calling this function again, which automatically refreshes the
   * view if need.
   *
   * Throws if passed an invalid `n`.
   *
   * Use of this function in client code is very rare. In practice, one of the
   * (faster) convenience forms is used.
   */
  heapForSize(n: 8, unsigned: false | undefined): Int8Array;
  heapForSize(n: 8, unsigned: true): Uint8Array;
  heapForSize(n: typeof Int8Array): Int8Array;
  heapForSize(n: typeof Uint8Array): Uint8Array;
  heapForSize(n: 16, unsigned: false | undefined): Int16Array;
  heapForSize(n: 16, unsigned: true): Uint16Array;
  heapForSize(n: typeof Int16Array): Int16Array;
  heapForSize(n: typeof Uint16Array): Uint16Array;
  heapForSize(n: 32, unsigned: false | undefined): Int32Array;
  heapForSize(n: 32, unsigned: true): Uint32Array;
  heapForSize(n: typeof Int32Array): Int32Array;
  heapForSize(n: typeof Uint32Array): Uint32Array;
  heapForSize(n: 64, unsigned: false | undefined): BigInt64Array;
  heapForSize(n: 64, unsigned: true): BigUint64Array;
  heapForSize(n: typeof Int32Array): BigInt64Array;
  heapForSize(n: typeof Uint32Array): BigUint64Array;

  /** Faster convenience method to get a Int8Array view of the WASM heap. */
  heap8: () => Int8Array;

  /** Faster convenience method to get a UInt8Array view of the WASM heap. */
  heap8u: () => Uint8Array;

  /** Faster convenience method to get a Int16Array view of the WASM heap. */
  heap16: () => Int16Array;

  /** Faster convenience method to get a UInt16Array view of the WASM heap. */
  heap16u: () => Uint16Array;

  /** Faster convenience method to get a Int32Array view of the WASM heap. */
  heap32: () => Int32Array;

  /** Faster convenience method to get a UInt32Array view of the WASM heap. */
  heap32u: () => Uint32Array;

  /** Faster convenience method to get a BigInt64Array view of the WASM heap. */
  heap64: () => BigInt64Array;

  /** Faster convenience method to get a BigUint64Array view of the WASM heap. */
  heap64u: () => BigUint64Array;

  /**
   * Fetches the `heapForSize()` for the given representation then writes the
   * given numeric value to it. Only numbers may be written this way, and
   * passing a non-number might trigger an exception. If passed an array of
   * pointers, it writes the given value to all of them.
   *
   * Returns this.
   */
  poke(addr: WasmPointer, value: number, representation?: string): WASM_API;
  poke(addrs: WasmPointer[], value: number, representation?: string): WASM_API;

  /**
   * Equivalent to `poke(X,Y,'*')`. Most frequently used for clearing output
   * pointer values.
   */
  pokePtr: (addr: WasmPointer, value: number) => WASM_API;

  /** Equivalent to poke(X,Y,'i8') */
  poke8: (addr: WasmPointer, value: number) => WASM_API;

  /** Equivalent to poke(X,Y,'i16') */
  poke16: (addr: WasmPointer, value: number) => WASM_API;

  /** Equivalent to poke(X,Y,'i32') */
  poke32: (addr: WasmPointer, value: number) => WASM_API;

  /** Equivalent to poke(X,Y,'i64') */
  poke64: (addr: WasmPointer, value: number) => WASM_API;

  /** Equivalent to poke(X,Y,'f32') */
  poke32f: (addr: WasmPointer, value: number) => WASM_API;

  /** Equivalent to poke(X,Y,'f64') */
  poke64f: (addr: WasmPointer, value: number) => WASM_API;

  /* --------------------------------------------------------------------------
   * String Conversion and Utilities
   * --------------------------------------------------------------------------
   * Passing strings into and out of WASM is frequently required, but how JS
   * and C code represent strings varies significantly. The following routines
   * are available for conversion of strings and related algorithms.
   */

  /**
   * Expects to be given a C-style string array and its length. It returns a JS
   * array of strings and/or null values: any entry in the `pArgv` array which
   * is `NULL` results in a null entry in the result array. If `argc` is 0 then
   * an empty array is returned.
   *
   * Results are `undefined` if any entry in the first `argc` entries of `pArgv`
   * are neither `0` (`NULL`) nor legal UTF-format C strings.
   *
   * To be clear, the expected C-style arguments to be passed to this function
   * are `(int, char **)` (optionally const-qualified).
   */
  cArgvToJs: (
    argc: number,
    pArgv: WasmPointer,
  ) => (string | null)[] | undefined;

  /**
   * Expects its argument to be a pointer into the WASM heap memory which refers
   * to a NUL-terminated C-style string encoded as UTF-8. This function counts
   * its byte length using `cstrlen()` then returns a JS-format string
   * representing its contents. As a special case, if the argument is falsy,
   * `null` is returned.
   */
  cstrToJs: (ptr: WasmPointer) => string | null;

  /**
   * Expects its argument to be a pointer into the WASM heap memory which refers
   * to a NUL-terminated C-style string encoded as UTF-8. Returns the length, in
   * bytes, of the string, as for `strlen(3)`. As a special case, if the
   * argument is falsy then it it returns null. Throws if the argument is out of
   * range for `wasm.heap8u()`.
   */
  cstrlen: (ptr: WasmPointer) => number | null;

  /**
   * Works similarly to C's `strncpy(3)`, copying, at most, `n` bytes (not
   * characters) from `srcPtr` to `tgtPtr`. It copies until `n` bytes have been
   * copied or a `0` byte is reached in `src`. Unlike `strncpy()`, it returns
   * the number of bytes it assigns in `tgtPtr`, including the NUL byte (if
   * any). If `n` is reached before a NUL byte in `srcPtr`, `tgtPtr` will not be
   * NUL-terminated. If a NUL byte is reached before `n` bytes are copied,
   * `tgtPtr` will be NUL-terminated.
   *
   * If `n` is negative, `cstrlen(srcPtr)+1` is used to calculate it, the `+1`
   * being for the NUL byte.
   *
   * Throws if `tgtPtr` or `srcPtr` are falsy. Results are `undefined` if:
   *
   * - Either is not a pointer into the WASM heap or
   * - `srcPtr` is not NUL-terminated AND `n` is less than `srcPtr`'s logical
   *   length.
   *
   * **ACHTUNG:** when passing in a non-negative `n` value, it is possible to
   * copy partial multi-byte characters this way, and converting such strings
   * back to JS strings will have undefined results.
   */
  cstrncpy: (tgtPtr: WasmPointer, srcPtr: WasmPointer, n: number) => number;

  /**
   * Forewarning: this API is somewhat complicated and is, in practice, never
   * needed from client code.
   *
   * Encodes the given JS string as UTF-8 into the given `TypedArray` `tgt`
   * (which must be a `Int8Array` or `Uint8Array`), starting at the given offset
   * and writing, at most, `maxBytes` bytes (including the NUL terminator if
   * `addNul` is true, else no NUL is added). If it writes any bytes at all and
   * `addNul` is true, it always NUL-terminates the output, even if doing so
   * means that the NUL byte is all that it writes.
   *
   * If `maxBytes` is negative (the default) then it is treated as the remaining
   * length of `tgt`, starting at the given offset.
   *
   * If writing the last character would surpass the `maxBytes` count because
   * the character is multi-byte, that character will not be written (as opposed
   * to writing a truncated multi-byte character). This can lead to it writing
   * as many as 3 fewer bytes than `maxBytes` specifies.
   *
   * Returns the number of bytes written to the target, including the NUL
   * terminator (if any). If it returns 0, it wrote nothing at all, which can
   * happen if:
   *
   *     jsString is empty and addNul is false.
   *     offset < 0.
   *     maxBytes === 0.
   *     maxBytes is less than the byte length of a multi-byte jsString[0].
   *
   * Throws if `tgt` is not an `Int8Array` or `Uint8Array`.
   */
  jstrcpy: (
    jsString: string,
    tgt: Int8Array | Uint8Array,
    offset?: number,
    maxBytes?: number,
    addNul?: boolean,
  ) => number;

  /**
   * Given a JS string, this function returns its UTF-8 length in bytes. Returns
   * `null` if its argument is not a string. This is a relatively expensive
   * calculation and should be avoided when not necessary.
   */
  jstrlen: (jsString: string) => number | null;

  /**
   * For the given JS string, returns a `Uint8Array` of its contents encoded as
   * UTF-8. If `addNul` is true, the returned array will have a trailing 0
   * entry, else it will not.
   *
   * Trivia: this was written before JS's TextEncoder was known to this code's
   * author. The same functionality, sans the trailing NUL option, can be
   * achieved with new TextEncoder().encode(str).
   */
  jstrToUintArray: (jsString: string, addNul?: boolean) => Uint8Array;

  /* --------------------------------------------------------------------------
   * String Conversion and Utilities
   * --------------------------------------------------------------------------
   */

  /**
   * `wasm.alloc()`'s `srcTypedArray.byteLength` bytes, populates them with the
   * values from the source `TypedArray`, and returns the pointer to that
   * memory. The returned pointer must eventually be passed to `wasm.dealloc()`
   * to clean it up.
   *
   * The argument may be a `Uint8Array`, `Int8Array`, or `ArrayBuffer`, and it
   * throws if passed any other type.
   *
   * As a special case, to avoid further special cases where this routine is
   * used, if `srcTypedArray.byteLength` is 0, it allocates a single byte and
   * sets it to the value 0. Even in such cases, calls must behave as if the
   * allocated memory has exactly `srcTypedArray.byteLength` usable bytes.
   */
  allocFromTypedArray: (
    srcTypedArray: Uint8Array | Int8Array | ArrayBuffer,
  ) => WasmPointer;

  /* ==========================================================================
   * Bridging JS/WASM Functions
   * ==========================================================================
   * This section documents the helper APIs related to bridging the gap
   * between JavaScript and WebAssembly functions.
   *
   * A WASM module exposes all exported functions to the user, but they are in
   * "raw" form. That is, they perform no argument or result type conversion and only
   * support data types supported by WASM (i.e. only numeric types). That's fine
   * for functions which only accept and return numbers, but is generally less
   * helpful for functions which take or return strings or have output pointers.
   * For usability reasons, it's desirable to reduce the JS/C friction by
   * automatically performing mundane tasks such as the allocation and
   * deallocation of memory needed for converting strings between JS and WASM.
   *
   * Additionally, it's often useful to add new functions to the WASM runtime
   * from JS, which requires compiling binary WASM code on the fly. A common
   * example of this is creating user-defined SQL functions. For the most
   * part, the JS bindings of the sqlite3 API take care of such conversions
   * for the user, but there are cases where client code will need to, or want
   * to, perform such conversions itself.
   */

  /* --------------------------------------------------------------------------
   * WASM Function Table
   * --------------------------------------------------------------------------
   *
   * WASM-exported functions, as well as JavaScript functions which have been
   * bound to WASM at runtime, are exposed to clients via a `WebAssembly.Table`
   * instance. The following APIs are available for working with that.
   */

  /**
   * Given a function pointer, returns the WASM function table entry if found,
   * else returns a falsy value.
   */
  functionEntry: (fnPtr: WasmPointer) => Function | undefined;

  /** Returns the WASM module's indirect function table. */
  functionTable: () => WebAssembly.Table;

  /* --------------------------------------------------------------------------
   * Calling and Wrapping Functions
   * --------------------------------------------------------------------------
   */

  /**
   * Calls a WASM-exported function by name, passing on all supplied arguments
   * (which may optionally be supplied as an array). If throws if the function
   * is not exported or if the argument count does not match. This routine does
   * no type conversion and is essentially equivalent to:
   *
   *     const rc = wasm.exports.some_func(...args);
   *
   * With the exception that `xCall()` throws if the argument count does not
   * match that of the WASM-exported function.
   */
  xCall(fn: string | Function, ...args: any[]): any;
  xCall(fn: string | Function, args: any[]): any;

  /**
   * Functions like `xCall()` but performs argument and result type conversions
   * as for `xWrap()`.
   *
   * The first argument is the name of the exported function to call. The 2nd
   * its the name of its result type, as documented for `xWrap()`. The 3rd is an
   * array of argument type names, as documented for `xWrap()`. The 4th+
   * arguments are arguments for the call, with the special case that if the 4th
   * argument is an array, it is used as the arguments for the call.
   *
   * Returns the converted result of the call.
   *
   * This is just a thin wrapper around `xWrap()`. If the given function is to
   * be called more than once, it's more efficient to use `xWrap()` to create a
   * wrapper, then to call that wrapper as many times as needed. For one-shot
   * calls, however, this variant is arguably more efficient because it will
   * hypothetically free the wrapper function quickly.
   */
  xCallWrappe(
    functionName: string,
    resultType: string,
    argTypes: string[],
    ...args: any[]
  ): any;
  xCallWrapped(
    functionName: string,
    resultType: string,
    argTypes: string[],
    args: any[],
  ): any;

  /**
   * Returns a WASM-exported function by name, or throws if the function is not
   * found.
   */
  xGet: (functionName: string) => Function;

  /**
   * `xWrap()` creates a JS function which calls a WASM-exported function, as
   * described for `xCall(`).
   *
   * Creates a wrapper for the WASM-exported function `fname`. It uses `xGet()`
   * to fetch the exported function (which throws on error) and returns either
   * that function or a wrapper for that function which converts the JS-side
   * argument types into WASM-side types and converts the result type. If the
   * function takes no arguments and `resultType` is null then the function is
   * returned as-is, else a wrapper is created for it to adapt its arguments and
   * result value, as described below.
   *
   * This function's arguments are:
   *
   * - `functionName`: the exported function's name. `xGet()` is used to fetch
   *   this, so will throw if no exported function is found with that name.
   * - `resultType`: the name of the result type. A literal `null` means to return
   *   the original function's value as-is (mnemonic: there is "null" conversion
   *   going on). Literal `undefined` or the string `"void"` mean to ignore the
   *   function's result and return `undefined`. Aside from those two special
   *   cases, it may be one of the values described below or any mapping
   *   installed by the client using `xWrap.resultAdapter()`.
   *
   * If passed 3 arguments and the final one is an array, that array must
   * contain a list of type names (see below) for adapting the arguments from JS
   * to WASM. If passed 2 arguments, more than 3, or the 3rd is not an array,
   * all arguments after the 2nd (if any) are treated as type names. In other
   * words, the following usages are equivalent:
   *
   *     xWrap('funcname', 'i32', 'string', 'f64');
   *     xWrap('funcname', 'i32', ['string', 'f64']);
   *
   * As are:
   *
   *     xWrap('funcname', 'i32'); // no arguments
   *     xWrap('funcname', 'i32', []);
   *
   * Type names are symbolic names which map the function's result and arguments
   * to an adapter function to convert, if needed, the value before passing it
   * on to WASM or to convert a return result from WASM.
   *
   * **The list of built-in names.**
   *
   * The following lists describe each, noting that some apply only to arguments
   * or return results, the two often having different semantics:
   *
   * - `i8`, `i16`, `i32` (args and results): all integer conversions which
   *   convert their argument to an integer and truncate it to the given bit
   *   length.
   * - `N*` (args): a type name in the form `N*`, where N is a numeric type name,
   *   is treated the same as WASM pointer.
   * - `*` and `pointer` (args): are assumed to be opaque WASM pointers and are
   *   treated like the current WASM pointer numeric type. Non-numbers will
   *   coerce to a value of 0 and out-of-range numbers will have `undefined`
   *   results (as with any pointer misuse).
   * - `*` and `pointer` (results): are aliases for the current WASM pointer
   *   numeric type.
   * - `**` (args): is simply a descriptive alias for `'*'`. It's primarily
   *   intended to mark output-pointer arguments.
   * - `i64` (args and results): passes the value to `BigInt()` to convert it to
   *   an `int64`. Only available if `BigInt` support is enabled.
   * - `f32` (float), `f64` (double) (args and results): pass their argument to
   *   `Number()`. i.e. the adapter does not currently distinguish between the
   *   two types of floating-point numbers.
   * - `number` (results): converts the result to a JS Number using
   *   `Number(theValue).valueOf()`. Note that this is for result conversions
   *   only, as it's not possible to generically know which type of number to
   *   convert arguments to.
   *
   * Non-numeric conversions include:
   *
   * - `string` or `utf8` (args): has two different semantics in order to
   *   accommodate various uses of certain C APIs...
   *
   *   - If the arg is a JS string, a temporary C-string, UTF-8 encoded, is created
   *       to pass to the exported function, which gets cleaned up before the
   *       wrapper returns. If a long-lived C-string pointer is required,
   *       client-side code is required to create the string, then pass its
   *       pointer to the function.
   *   - Else the arg is assumed to be a pointer to a string the client has already
   *       allocated and it's passed on as a WASM pointer.
   * - `string` or `utf8` (results): treats the result value as a const C-string,
   *   encoded as UTF-8, copies it to a JS string, and returns that JS string.
   * - `string:dealloc` or `utf8:dealloc` (results): treats the result value as a
   *   non-const C-string, encoded as UTF-8, ownership of which has just been
   *   transfered to the caller. It copies the C-string to a JS string, frees
   *   the C-string using `dealloc()`, and returns the JS string. If such a
   *   result value is NULL, the JS result is null. **Achtung:** when using an
   *   API which returns results from a specific allocator, this conversion is
   *   not legal. Instead, an equivalent conversion which uses the appropriate
   *   deallocator is required. An example of such is provided in the next
   *   section.
   * - `string:flexible` (args): are an expanded version of `string` described in
   *   the C-style API docs. These are widely used for SQL string inputs in the
   *   library.
   * - `string:static` (args): if passed a pointer, returns it as is. Anything
   *   else: gets coerced to a JS string for use as a map key. If a matching
   *   entry is found (as described next), it is returned, else
   *   `wasm.allocCString()` is used to create a a new string, map its pointer
   *   to `(''+v)` for the remainder of the application's life, and returns that
   *   pointer value for this call and all future calls which are passed a
   *   string-equivalent argument. This conversion is intended for cases which
   *   require static/long-lived string arguments, e.g. `sqlite3_bind_pointer()`
   *   and `sqlite3_result_pointer()`.
   * - `json` (results): treats the result as a const C-string and returns the
   *   result of passing the converted-to-JS string to `JSON.parse()`. Returns
   *   `null` if the C-string is a NULL pointer. Propagates any exception from
   *   `JSON.parse()`.
   * - `json:dealloc` (results): works exactly like `string:dealloc` but returns
   *   the same thing as the json adapter. Note the warning in `string:dealloc`
   *   about the allocator and deallocator.
   *
   * The type names for results and arguments are validated when `xWrap()` is
   * called and any unknown names will trigger an exception.
   *
   * Clients may map their own result and argument adapters using
   * `xWrap.resultAdapter()` and `xWrap.argAdaptor()`, noting that not all type
   * conversions are valid for both arguments and result types as they often
   * have different memory ownership requirements. That topic is covered in the
   * next section...
   *
   * **Argument and Result Value Type Conversions**
   *
   * When `xWrap()` is called and evaluates function call signatures, it looks
   * up the argument and result type adapters for a match. It is possible to
   * install custom adapters for arguments and result values using the methods
   * listed below.
   *
   * `xWrap()` has two methods with identical signatures:
   *
   *     xWrap.argAdapter(string, function)
   *     xWrap.resultAdapter(string, function)
   *
   * Each one expects a type name string, such as the ones described for
   * `xWrap()`, and a function which is passed a single value and must return
   * that value, a conversion of that value, or throw an exception. Each of
   * those functions returns itself so that calls may be chained.
   *
   * For example's sake, let's assume we have a C-bound function which returns a
   * C-style string allocated using a non-default allocator, `my_str_alloc()`.
   * The returned memory is owned by the caller and must be freed, but needs to
   * be freed using the allocator's deallocation counterpart, `my_str_free()`.
   * We can create such a result value adapter with:
   *
   *     wasm.xWrap.resultAdaptor('my_str_alloc*', (v)=>{
   *       try { return v ? target.cstrToJs(v) : null }
   *       finally{ wasm.exports.my_str_free(v) }
   *     };
   *
   * With that in place, we can make calls like:
   *
   *     const f = wasm.xWrap('my_function', 'my_str_alloc*', [
   *       'i32',
   *       'string',
   *     ]);
   *     const str = f(17, 'hello, world');
   *     // ^^^ the memory allocated for the result using my_str_alloc()
   *     //     is freed using my_str_free() before f() returns.
   *
   * Similarly, let's assume that we have a custom JS class which has a member
   * property named `pointer` which refers to C-side memory of a struct which
   * this JS class represents. We can then make it legal to pass such objects on
   * to the C APIs with something like:
   *
   *     const argPointer = wasm.xWrap.argAdapter('*'); // default pointer-type adapter
   *     wasm.xWrap.argAdaptor('MyType', (v) => {
   *       if (v instanceof MyType) v = v.pointer;
   *       if (wasm.isPtr(v)) return argPointer(v);
   *       throw new Error('Invalid value for MyType argument.');
   *     });
   *
   * With that in place we can wrap one of our functions like:
   *
   *     const f = wasm.xWrap('MyType_method', undefined, ['MyType', 'i32']);
   *     const my = new MyType(...);
   *     // ^^^ assume this allocates WASM memory referenced via my.pointer.
   *     f( my, // will use my.pointer
   *        17 );
   *
   * Similar conversions can be done for result values, though how to do so for
   * result values depends entirely on client-side semantics of memory
   * management.
   */
  xWrap(
    functionName: string,
    resultType: string | undefined,
    ...argTypes: string[]
  ): Function;
  xWrap(
    functionName: string,
    resultType: string | undefined,
    argTypes: string[],
  ): Function;

  /* --------------------------------------------------------------------------
   * (Un)Installing WASM Functions
   * --------------------------------------------------------------------------
   * When using C APIs which take callback function pointers, one cannot
   * simply pass JS functions to them. Instead, the JS function has to be
   * proxied into WASM environment and that proxy has to be passed to C. That
   * is done by compiling, on the fly, a small amount of binary WASM code
   * which describes the function's signature in WASM terms, forwards its
   * arguments to the provided JS function, and returns the result of that JS
   * function. The details are ugly, but usage is simple...
   */

  /**
   * Expects a JS function and signature, exactly as for `wasm.jsFuncToWasm()`.
   * It uses that function to create a WASM-exported function, installs that
   * function to the next available slot of `wasm.functionTable()`, and returns
   * the function's index in that table (which acts as a pointer to that
   * function). The returned pointer can be passed to `wasm.uninstallFunction()`
   * to uninstall it and free up the table slot for reuse.
   *
   * As a special case, if the passed-in function is a WASM-exported function
   * then the signature argument is ignored and `func` is installed as-is,
   * without requiring re-compilation/re-wrapping.
   *
   * This function will propagate an exception if `WebAssembly.Table.grow()`
   * throws or `wasm.jsFuncToWasm()` throws. The former case can happen in an
   * Emscripten-compiled environment when building without Emscripten's
   * `-sALLOW_TABLE_GROWTH` flag.
   */
  installFunction(func: Function, signature: string): WasmPointer;
  installFunction(signature: string, func: Function): WasmPointer;

  /**
   * Creates a WASM function which wraps the given JS function and returns the
   * JS binding of that WASM function. The function signature string must be in
   * the form used by jaccwabyt or Emscripten's `addFunction()`. In short: in
   * may have one of the following formats:
   *
   * - Emscripten: `"x..."`, where the first `x` is a letter representing the
   *   result type and subsequent letters represent the argument types. See
   *   below. Functions with no arguments have only a single letter.
   * - Jaccwabyt: `"x(...)"` where x is the letter representing the result type
   *   and letters in the parens (if any) represent the argument types.
   *   Functions with no arguments use `x()`. See below.
   *
   * Supported letters:
   *
   * - `i` = `int32`
   * - `p` = `int32` ("pointer")
   * - `j` = `int64`
   * - `f` = `float32`
   * - `d` = `float64`
   * - `v` = `void`, only legal for use as the result type
   *
   * It throws if an invalid signature letter is used.
   *
   * Jaccwabyt-format signatures support some additional letters which have no
   * special meaning here but (in this context) act as aliases for other
   * letters:
   *
   * - `s`, `P`: same as `p`
   */
  jsFuncToWasm(func: Function, signature: string): Function;
  jsFuncToWasm(signature: string, func: Function): Function;

  /**
   * This works exactly like `installFunction()` except that the installation is
   * scoped to the current allocation scope and is uninstalled when the current
   * allocation scope is popped. It will throw if no allocation scope is
   * active.
   */
  scopedInstallFunction(func: Function, signature: string): WasmPointer;
  scopedInstallFunction(signature: string, func: Function): WasmPointer;

  /**
   * Requires a pointer value previously returned from `wasm.installFunction()`.
   * Removes that function from the WASM function table, marks its table slot as
   * free for re-use, and returns that function. It is illegal to call this
   * before `installFunction()` has been called and results are undefined if the
   * argument was not returned by that function. The returned function may be
   * passed back to `installFunction()` to reinstall it.
   */
  uninstallFunction: (fnPtr: WasmPointer) => Function;

  /* ==========================================================================
   * Generic Utility Functions
   * ==========================================================================
   */

  /**
   * Returns true if its value is a WASM pointer type. That is, it's a a 32-bit
   * integer greater than or equal to zero.
   *
   * Sidebar: `isPtr()` is an alias for `isPtr32()`. If/when 64-bit WASM pointer
   * support becomes widespread, it will become an alias for either `isPtr32()`
   * or the as-yet-hypothetical `isPtr64()`, depending on a configuration
   * option.
   */
  isPtr: (v: unknown) => v is WasmPointer;

  /** See {@link WASM_API#isPtr} */
  isPtr32: (v: unknown) => v is WasmPointer;

  /** Size of a WASM pointer in bytes. */
  ptrSizeof: number;

  // Undocumented fields
  ptrIR: unknown;
  bigIntEnabled: unknown;
  memory: unknown;
  compileOptionUsed: unknown;
  getMemValue: unknown;
  getPtrValue: unknown;
  setMemValue: unknown;
  setPtrValue: unknown;
  sqlite3_wasm_db_reset: unknown;
  sqlite3_wasm_db_vfs: unknown;
  sqlite3_wasm_vfs_create_file: unknown;
  sqlite3_wasm_vfs_unlink: unknown;
  ctype: unknown;
};

// generated by Object.keys(sqlite3.capi).map(k => `${k}: any;`).join('\n')
declare type CAPI = {
  sqlite3_vfs: typeof sqlite3_vfs;
  sqlite3_io_methods: typeof sqlite3_io_methods;
  sqlite3_file: typeof sqlite3_file;
  sqlite3_vtab: typeof sqlite3_vtab;
  sqlite3_vtab_cursor: typeof sqlite3_vtab_cursor;
  sqlite3_module: typeof sqlite3_module;
  sqlite3_index_info: typeof sqlite3_index_info;
  sqlite3_bind_blob: (
    stmt: PreparedStatement | WasmPointer,
    idx: number,
    blob: WasmPointer,
    n: number,
    dtor:
      | (() => void)
      | WasmPointer
      | CAPI['SQLITE_STATIC']
      | CAPI['SQLITE_TRANSIENT']
      | CAPI['SQLITE_WASM_DEALLOC'],
  ) => number;
  sqlite3_bind_text: (
    stmt: PreparedStatement | WasmPointer,
    idx: number,
    text: string,
    n: number,
    dtor:
      | (() => void)
      | WasmPointer
      | CAPI['SQLITE_STATIC']
      | CAPI['SQLITE_TRANSIENT']
      | CAPI['SQLITE_WASM_DEALLOC'],
  ) => number;
  sqlite3_create_function_v2: (
    db: Database | WasmPointer,
    functionName: string | WasmPointer,
    nArg: number,
    eTextRep: number,
    pApp: WasmPointer,
    xFunc:
      | ((ctx: WasmPointer, nArg: number, args: WasmPointer) => void)
      | WasmPointer,
    xStep:
      | ((ctx: WasmPointer, nArg: number, args: WasmPointer) => void)
      | WasmPointer,
    xFinal: ((ctx: WasmPointer) => void) | WasmPointer,
    xDestroy: (() => void) | WasmPointer,
  ) => number;
  sqlite3_create_function: (
    db: Database | WasmPointer,
    functionName: string | WasmPointer,
    nArg: number,
    eTextRep: number,
    pApp: WasmPointer,
    xFunc:
      | ((ctx: WasmPointer, nArg: number, args: WasmPointer) => void)
      | WasmPointer,
    xStep:
      | ((ctx: WasmPointer, nArg: number, args: WasmPointer) => void)
      | WasmPointer,
    xFinal: ((ctx: WasmPointer) => void) | WasmPointer,
  ) => number;
  sqlite3_create_window_function: (
    db: Database | WasmPointer,
    functionName: string | WasmPointer,
    nArg: number,
    eTextRep: number,
    pApp: WasmPointer,
    xStep:
      | ((ctx: WasmPointer, nArg: number, args: WasmPointer) => void)
      | WasmPointer,
    xFinal: ((ctx: WasmPointer) => void) | WasmPointer,
    xValue: ((ctx: WasmPointer) => void) | WasmPointer,
    xInverse:
      | ((ctx: WasmPointer, nArg: number, args: WasmPointer) => void)
      | WasmPointer,
    xDestroy: (() => void) | WasmPointer,
  ) => number;
  sqlite3_prepare_v3: (
    db: Database | WasmPointer,
    sql: string | WasmPointer,
    nByte: number,
    prepFlags: number,
    ppStmt: WasmPointer,
    pzTail: WasmPointer,
  ) => number;
  sqlite3_prepare_v2: (
    db: Database | WasmPointer,
    sql: string | WasmPointer,
    nByte: number,
    ppStmt: WasmPointer,
    pzTail: WasmPointer,
  ) => number;
  sqlite3_exec: (
    db: Database | WasmPointer,
    sql: string | WasmPointer,
    callback:
      | ((
          cbArg: WasmPointer,
          nColumns: number,
          values: WasmPointer,
          names: WasmPointer,
        ) => number)
      | WasmPointer,
    cbArg: WasmPointer,
    pzErrMsg: WasmPointer,
  ) => number;
  sqlite3_randomness: (N: number, P: WasmPointer) => void;
  sqlite3_wasmfs_opfs_dir: () => string;
  sqlite3_wasmfs_filename_is_persistent: (name: string) => boolean;
  sqlite3_js_db_uses_vfs: (
    db: Database | WasmPointer,
    vfsName: string,
    dbName: string,
  ) => boolean;
  sqlite3_js_vfs_list: () => string[];
  sqlite3_js_db_export: (
    db: Database | WasmPointer,
    schema?: string | WasmPointer,
  ) => Uint8Array;
  sqlite3_js_db_vfs: (
    db: Database | WasmPointer,
    dbName?: string | WasmPointer,
  ) => WasmPointer;
  sqlite3_js_aggregate_context: (
    ctx: WasmPointer,
    nBytes: number,
  ) => WasmPointer;
  sqlite3_js_vfs_create_file: (
    vfs: string | WasmPointer | sqlite3_vfs,
    name: string | WasmPointer,
    data: undefined | WasmPointer | Uint8Array | ArrayBuffer,
    dataLen?: number,
  ) => void;
  sqlite3_db_config: (
    db: Database | WasmPointer,
    op:
      | CAPI['SQLITE_DBCONFIG_LOOKASIDE']
      | CAPI['SQLITE_DBCONFIG_ENABLE_FKEY']
      | CAPI['SQLITE_DBCONFIG_ENABLE_TRIGGER']
      | CAPI['SQLITE_DBCONFIG_ENABLE_VIEW']
      | CAPI['SQLITE_DBCONFIG_ENABLE_FTS3_TOKENIZER']
      | CAPI['SQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION']
      | CAPI['SQLITE_DBCONFIG_MAINDBNAME']
      | CAPI['SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE']
      | CAPI['SQLITE_DBCONFIG_ENABLE_QPSG']
      | CAPI['SQLITE_DBCONFIG_TRIGGER_EQP']
      | CAPI['SQLITE_DBCONFIG_RESET_DATABASE']
      | CAPI['SQLITE_DBCONFIG_DEFENSIVE']
      | CAPI['SQLITE_DBCONFIG_WRITABLE_SCHEMA']
      | CAPI['SQLITE_DBCONFIG_LEGACY_ALTER_TABLE']
      | CAPI['SQLITE_DBCONFIG_DQS_DML']
      | CAPI['SQLITE_DBCONFIG_DQS_DDL']
      | CAPI['SQLITE_DBCONFIG_TRUSTED_SCHEMA']
      | CAPI['SQLITE_DBCONFIG_LEGACY_FILE_FORMAT'],
    ...args: number[]
  ) => number;
  sqlite3_value_to_js(
    sqliteValue: WasmPointer,
    throwIfCannotConvert?: true,
  ): SqlValue;
  sqlite3_value_to_js(
    sqliteValue: WasmPointer,
    throwIfCannotConvert: false,
  ): SqlValue | undefined;
  sqlite3_values_to_js(
    numVals: number,
    sqliteValues: WasmPointer,
    throwIfCannotConvert?: true,
  ): SqlValue[];
  sqlite3_values_to_js(
    numVals: number,
    sqliteValues: WasmPointer,
    throwIfCannotConvert: false,
  ): (SqlValue | undefined)[];
  sqlite3_result_error_js: (ctx: WasmPointer, err: Error) => void;
  sqlite3_result_js: (
    ctx: WasmPointer,
    val:
      | Error
      | null
      | boolean
      | number
      | BigInt
      | string
      | Uint8Array
      | Int8Array
      | undefined,
  ) => void;
  sqlite3_column_js(
    stmt: PreparedStatement | WasmPointer,
    colIdx: number,
    throwIfCannotConvert?: true,
  ): SqlValue;
  sqlite3_column_js(
    stmt: PreparedStatement | WasmPointer,
    colIdx: number,
    throwIfCannotConvert: false,
  ): SqlValue | undefined;
  sqlite3_preupdate_new_js: (
    db: Database | WasmPointer,
    colIdx: number,
  ) => SqlValue;
  sqlite3_preupdate_old_js: (
    db: Database | WasmPointer,
    colIdx: number,
  ) => SqlValue;
  sqlite3changeset_new_js: (
    pChangeSetIter: WasmPointer,
    colIdx: number,
  ) => SqlValue;
  sqlite3changeset_old_js: (
    pChangeSetIter: WasmPointer,
    colIdx: number,
  ) => SqlValue;
  sqlite3_aggregate_context: (ctx: WasmPointer, nBytes: number) => WasmPointer;
  sqlite3_bind_double: (
    stmt: PreparedStatement | WasmPointer,
    idx: number,
    value: number,
  ) => number;
  sqlite3_bind_int: (
    stmt: PreparedStatement | WasmPointer,
    idx: number,
    value: number,
  ) => number;
  sqlite3_bind_null: (
    stmt: PreparedStatement | WasmPointer,
    idx: number,
  ) => number;
  sqlite3_bind_parameter_count: (
    stmt: PreparedStatement | WasmPointer,
  ) => number;
  sqlite3_bind_parameter_index: (
    stmt: PreparedStatement | WasmPointer,
    name: string | WasmPointer,
  ) => number;
  sqlite3_bind_pointer: (
    stmt: PreparedStatement | WasmPointer,
    idx: number,
    value: WasmPointer,
    type: string | WasmPointer,
    dtor:
      | (() => void)
      | WasmPointer
      | CAPI['SQLITE_STATIC']
      | CAPI['SQLITE_TRANSIENT']
      | CAPI['SQLITE_WASM_DEALLOC'],
  ) => number;
  sqlite3_busy_handler: (
    db: Database | WasmPointer,
    callback: ((cbArg: WasmPointer, nTries: number) => number) | WasmPointer,
    cbArg: WasmPointer,
  ) => number;
  sqlite3_busy_timeout: (db: Database | WasmPointer, ms: number) => number;
  sqlite3_changes: (db: Database | WasmPointer) => number;
  sqlite3_clear_bindings: (db: Database | WasmPointer) => number;
  sqlite3_collation_needed: (
    db: Database | WasmPointer,
    cbArg: WasmPointer,
    callback:
      | ((
          cbArg: WasmPointer,
          db: Database | WasmPointer,
          eTextRep: number,
          name: string | WasmPointer,
        ) => void)
      | WasmPointer,
  ) => number;
  sqlite3_column_blob: (
    stmt: PreparedStatement | WasmPointer,
    colIdx: number,
  ) => WasmPointer;
  sqlite3_column_bytes: (
    stmt: PreparedStatement | WasmPointer,
    colIdx: number,
  ) => number;
  sqlite3_column_count: (stmt: PreparedStatement | WasmPointer) => number;
  sqlite3_column_double: (
    stmt: PreparedStatement | WasmPointer,
    colIdx: number,
  ) => number;
  sqlite3_column_int: (
    stmt: PreparedStatement | WasmPointer,
    colIdx: number,
  ) => number;
  sqlite3_column_name: (
    stmt: PreparedStatement | WasmPointer,
    colIdx: number,
  ) => string;
  sqlite3_column_text: (
    stmt: PreparedStatement | WasmPointer,
    colIdx: number,
  ) => string;
  sqlite3_column_type: (
    stmt: PreparedStatement | WasmPointer,
    colIdx: number,
  ) => number;
  sqlite3_column_value: (
    stmt: PreparedStatement | WasmPointer,
    colIdx: number,
  ) => WasmPointer;

  sqlite3_commit_hook: (
    db: Database | WasmPointer,
    hook: ((cbArg: WasmPointer) => number) | WasmPointer,
    cbArg: WasmPointer,
  ) => void;
  sqlite3_compileoption_get: (idx: number) => string;
  sqlite3_compileoption_used: (optName: string) => number;
  sqlite3_complete: (sql: string | WasmPointer) => number;
  sqlite3_context_db_handle: (ctx: WasmPointer) => WasmPointer;
  sqlite3_data_count: (stmt: PreparedStatement | WasmPointer) => number;
  sqlite3_db_filename: (
    db: Database | WasmPointer,
    dbName: string | WasmPointer,
  ) => string;
  sqlite3_db_handle: (stmt: PreparedStatement | WasmPointer) => WasmPointer;
  sqlite3_db_name: (db: Database | WasmPointer, dbIdx: number) => string;
  sqlite3_db_status: (
    db: Database | WasmPointer,
    op:
      | CAPI['SQLITE_DBSTATUS_LOOKASIDE_USED']
      | CAPI['SQLITE_DBSTATUS_CACHE_USED']
      | CAPI['SQLITE_DBSTATUS_SCHEMA_USED']
      | CAPI['SQLITE_DBSTATUS_STMT_USED']
      | CAPI['SQLITE_DBSTATUS_LOOKASIDE_HIT']
      | CAPI['SQLITE_DBSTATUS_LOOKASIDE_MISS_SIZE']
      | CAPI['SQLITE_DBSTATUS_LOOKASIDE_MISS_FULL']
      | CAPI['SQLITE_DBSTATUS_CACHE_HIT']
      | CAPI['SQLITE_DBSTATUS_CACHE_MISS']
      | CAPI['SQLITE_DBSTATUS_CACHE_WRITE']
      | CAPI['SQLITE_DBSTATUS_DEFERRED_FKS']
      | CAPI['SQLITE_DBSTATUS_CACHE_USED_SHARED']
      | CAPI['SQLITE_DBSTATUS_CACHE_SPILL']
      | CAPI['SQLITE_DBSTATUS_MAX'],
    pCur: WasmPointer,
    pHighWater: WasmPointer,
    resetFlag: number,
  ) => number;
  sqlite3_errcode: (db: Database | WasmPointer) => number;
  sqlite3_errmsg: (db: Database | WasmPointer) => string;
  sqlite3_error_offset: (db: Database | WasmPointer) => number;
  sqlite3_errstr: (rc: number) => string;
  sqlite3_expanded_sql: (stmt: PreparedStatement | WasmPointer) => string;
  sqlite3_extended_errcode: (db: Database | WasmPointer) => number;
  sqlite3_extended_result_codes: (
    db: Database | WasmPointer,
    onoff: number,
  ) => number;
  sqlite3_file_control: (
    db: Database | WasmPointer,
    dbName: string | WasmPointer,
    op:
      | CAPI['SQLITE_FCNTL_BEGIN_ATOMIC_WRITE']
      | CAPI['SQLITE_FCNTL_LOCKSTATE']
      | CAPI['SQLITE_FCNTL_GET_LOCKPROXYFILE']
      | CAPI['SQLITE_FCNTL_SET_LOCKPROXYFILE']
      | CAPI['SQLITE_FCNTL_LAST_ERRNO']
      | CAPI['SQLITE_FCNTL_SIZE_HINT']
      | CAPI['SQLITE_FCNTL_CHUNK_SIZE']
      | CAPI['SQLITE_FCNTL_FILE_POINTER']
      | CAPI['SQLITE_FCNTL_SYNC_OMITTED']
      | CAPI['SQLITE_FCNTL_WIN32_AV_RETRY']
      | CAPI['SQLITE_FCNTL_PERSIST_WAL']
      | CAPI['SQLITE_FCNTL_OVERWRITE']
      | CAPI['SQLITE_FCNTL_VFSNAME']
      | CAPI['SQLITE_FCNTL_POWERSAFE_OVERWRITE']
      | CAPI['SQLITE_FCNTL_PRAGMA']
      | CAPI['SQLITE_FCNTL_BUSYHANDLER']
      | CAPI['SQLITE_FCNTL_TEMPFILENAME']
      | CAPI['SQLITE_FCNTL_MMAP_SIZE']
      | CAPI['SQLITE_FCNTL_TRACE']
      | CAPI['SQLITE_FCNTL_HAS_MOVED']
      | CAPI['SQLITE_FCNTL_SYNC']
      | CAPI['SQLITE_FCNTL_COMMIT_PHASETWO']
      | CAPI['SQLITE_FCNTL_WIN32_SET_HANDLE']
      | CAPI['SQLITE_FCNTL_WAL_BLOCK']
      | CAPI['SQLITE_FCNTL_ZIPVFS']
      | CAPI['SQLITE_FCNTL_RBU']
      | CAPI['SQLITE_FCNTL_VFS_POINTER']
      | CAPI['SQLITE_FCNTL_JOURNAL_POINTER']
      | CAPI['SQLITE_FCNTL_WIN32_GET_HANDLE']
      | CAPI['SQLITE_FCNTL_PDB']
      | CAPI['SQLITE_FCNTL_BEGIN_ATOMIC_WRITE']
      | CAPI['SQLITE_FCNTL_COMMIT_ATOMIC_WRITE']
      | CAPI['SQLITE_FCNTL_ROLLBACK_ATOMIC_WRITE']
      | CAPI['SQLITE_FCNTL_LOCK_TIMEOUT']
      | CAPI['SQLITE_FCNTL_DATA_VERSION']
      | CAPI['SQLITE_FCNTL_SIZE_LIMIT']
      | CAPI['SQLITE_FCNTL_CKPT_DONE']
      | CAPI['SQLITE_FCNTL_RESERVE_BYTES']
      | CAPI['SQLITE_FCNTL_CKPT_START']
      | CAPI['SQLITE_FCNTL_EXTERNAL_READER']
      | CAPI['SQLITE_FCNTL_CKSM_FILE']
      | CAPI['SQLITE_FCNTL_RESET_CACHE'],
    arg: WasmPointer,
  ) => number;
  sqlite3_finalize: (stmt: PreparedStatement | WasmPointer) => number;
  sqlite3_free: (ptr: WasmPointer) => void;
  sqlite3_get_auxdata: (ctx: WasmPointer, n: number) => WasmPointer;
  sqlite3_initialize: () => number;
  sqlite3_keyword_count: () => number;
  sqlite3_keyword_name: (
    i: number,
    pOut: WasmPointer,
    pOutLen: WasmPointer,
  ) => number;
  sqlite3_keyword_check: (name: string | WasmPointer, n: number) => number;
  sqlite3_libversion: () => string;
  sqlite3_libversion_number: () => number;
  sqlite3_limit: (
    db: Database | WasmPointer,
    id: number,
    newVal: number,
  ) => number;
  sqlite3_malloc: (size: number) => WasmPointer;
  sqlite3_open: (filename: string | WasmPointer, ppDb: WasmPointer) => number;
  sqlite3_open_v2: (
    filename: string | WasmPointer,
    ppDb: WasmPointer,
    flags: number,
    vfs: string | WasmPointer,
  ) => number;
  sqlite3_progress_handler: (
    db: Database | WasmPointer,
    nOps: number,
    callback: ((cbArg: WasmPointer) => number) | WasmPointer,
    cbArg: WasmPointer,
  ) => void;
  sqlite3_realloc: (ptr: WasmPointer, size: number) => WasmPointer;
  sqlite3_reset: (stmt: PreparedStatement | WasmPointer) => number;

  sqlite3_result_blob: (
    ctx: WasmPointer,
    blob: WasmPointer,
    blobLen: number,
    dtor:
      | (() => void)
      | WasmPointer
      | CAPI['SQLITE_STATIC']
      | CAPI['SQLITE_TRANSIENT']
      | CAPI['SQLITE_WASM_DEALLOC'],
  ) => void;
  sqlite3_result_double: (ctx: WasmPointer, value: number) => void;
  sqlite3_result_error: (
    ctx: WasmPointer,
    msg: string | WasmPointer,
    msgLen: number,
  ) => void;
  sqlite3_result_error_code: (ctx: WasmPointer, code: number) => void;
  sqlite3_result_error_nomem: (ctx: WasmPointer) => void;
  sqlite3_result_error_toobig: (ctx: WasmPointer) => void;
  sqlite3_result_int: (ctx: WasmPointer, value: number) => void;
  sqlite3_result_null: (ctx: WasmPointer) => void;
  sqlite3_result_pointer: (
    ctx: WasmPointer,
    value: WasmPointer,
    type: string | WasmPointer,
    dtor:
      | (() => void)
      | WasmPointer
      | CAPI['SQLITE_STATIC']
      | CAPI['SQLITE_TRANSIENT']
      | CAPI['SQLITE_WASM_DEALLOC'],
  ) => void;
  sqlite3_result_subtype: (ctx: WasmPointer, subtype: number) => void;
  sqlite3_result_text: (
    ctx: WasmPointer,
    text: string | WasmPointer,
    textLen: number,
    dtor:
      | (() => void)
      | WasmPointer
      | CAPI['SQLITE_STATIC']
      | CAPI['SQLITE_TRANSIENT']
      | CAPI['SQLITE_WASM_DEALLOC'],
  ) => void;
  sqlite3_result_zeroblob: (ctx: WasmPointer, blobLen: number) => void;

  sqlite3_rollback_hook: (
    db: Database | WasmPointer,
    hook: ((cbArg: WasmPointer) => number) | WasmPointer,
    cbArg: WasmPointer,
  ) => void;
  sqlite3_set_authorizer: (
    db: Database | WasmPointer,
    xAuth: (
      cbArg: WasmPointer,
      actionCode: number,
      arg1: string | 0,
      arg2: string | 0,
      arg3: string | 0,
      arg4: string | 0,
    ) => number,
    cbArg: WasmPointer,
  ) => number;
  sqlite3_set_auxdata: (
    ctx: WasmPointer,
    n: number,
    pAux: WasmPointer,
    xDelete: (() => void) | WasmPointer,
  ) => void;
  sqlite3_shutdown: () => number;
  sqlite3_sourceid: () => string;
  sqlite3_sql: (stmt: PreparedStatement | WasmPointer) => string;
  sqlite3_status: (
    op:
      | CAPI['SQLITE_STATUS_MEMORY_USED']
      | CAPI['SQLITE_STATUS_MALLOC_SIZE']
      | CAPI['SQLITE_STATUS_MALLOC_COUNT']
      | CAPI['SQLITE_STATUS_PAGECACHE_USED']
      | CAPI['SQLITE_STATUS_PAGECACHE_OVERFLOW']
      | CAPI['SQLITE_STATUS_PAGECACHE_SIZE']
      | CAPI['SQLITE_STATUS_SCRATCH_USED']
      | CAPI['SQLITE_STATUS_SCRATCH_OVERFLOW']
      | CAPI['SQLITE_STATUS_SCRATCH_SIZE'],
    pCurrent: WasmPointer,
    pHighwater: WasmPointer,
    resetFlag: number,
  ) => number;
  sqlite3_step: (stmt: PreparedStatement | WasmPointer) => number;
  sqlite3_stmt_isexplain: (stmt: PreparedStatement | WasmPointer) => number;
  sqlite3_stmt_readonly: (stmt: PreparedStatement | WasmPointer) => number;
  sqlite3_stmt_status: (
    stmt: PreparedStatement | WasmPointer,
    op:
      | CAPI['SQLITE_STMTSTATUS_FULLSCAN_STEP']
      | CAPI['SQLITE_STMTSTATUS_SORT']
      | CAPI['SQLITE_STMTSTATUS_AUTOINDEX']
      | CAPI['SQLITE_STMTSTATUS_VM_STEP']
      | CAPI['SQLITE_STMTSTATUS_REPREPARE']
      | CAPI['SQLITE_STMTSTATUS_RUN']
      | CAPI['SQLITE_STMTSTATUS_FILTER_MISS']
      | CAPI['SQLITE_STMTSTATUS_FILTER_HIT']
      | CAPI['SQLITE_STMTSTATUS_MEMUSED'],
    resetFlag: number,
  ) => number;
  sqlite3_strglob: (
    glob: string | WasmPointer,
    str: string | WasmPointer,
  ) => number;
  sqlite3_stricmp: (
    str1: string | WasmPointer,
    str2: string | WasmPointer,
  ) => number;
  sqlite3_strlike: (
    glob: string | WasmPointer,
    str: string | WasmPointer,
    esc: number,
  ) => number;
  sqlite3_strnicmp: (
    str1: string | WasmPointer,
    str2: string | WasmPointer,
    n: number,
  ) => number;
  sqlite3_table_column_metadata: (
    db: Database | WasmPointer,
    dbName: string | WasmPointer,
    tblName: string | WasmPointer,
    colName: string | WasmPointer,
    pDataType: WasmPointer,
    pCollSeq: WasmPointer,
    pNotNull: WasmPointer,
    pPrimaryKey: WasmPointer,
    pAutoinc: WasmPointer,
  ) => number;
  sqlite3_total_changes: (db: Database | WasmPointer) => number;
  sqlite3_trace_v2: (
    db: Database | WasmPointer,
    mask: number,
    xCallback: (
      reason:
        | CAPI['SQLITE_TRACE_CLOSE']
        | CAPI['SQLITE_TRACE_PROFILE']
        | CAPI['SQLITE_TRACE_ROW']
        | CAPI['SQLITE_TRACE_STMT'],
      cbArg: WasmPointer,
      arg1: WasmPointer,
      arg2: WasmPointer,
    ) => number,
  ) => number;
  sqlite3_txn_state: (
    db: Database | WasmPointer,
    schema: string | WasmPointer,
  ) =>
    | CAPI['SQLITE_TXN_NONE']
    | CAPI['SQLITE_TXN_READ']
    | CAPI['SQLITE_TXN_WRITE']
    | -1;
  sqlite3_uri_boolean: (
    uri: string | WasmPointer,
    param: string | WasmPointer,
    dflt: number,
  ) => number;
  sqlite3_uri_key: (uri: string | WasmPointer, idx: number) => string;
  sqlite3_uri_parameter: (
    uri: string | WasmPointer,
    param: string | WasmPointer,
  ) => string;
  sqlite3_user_data: (ctx: WasmPointer) => WasmPointer;

  sqlite3_value_blob: (sqliteValue: WasmPointer) => WasmPointer;
  sqlite3_value_bytes: (sqliteValue: WasmPointer) => number;
  sqlite3_value_double: (sqliteValue: WasmPointer) => number;
  sqlite3_value_dup: (sqliteValue: WasmPointer) => WasmPointer;
  sqlite3_value_free: (sqliteValue: WasmPointer) => void;
  sqlite3_value_frombind: (sqliteValue: WasmPointer) => number;
  sqlite3_value_int: (sqliteValue: WasmPointer) => number;
  sqlite3_value_nochange: (sqliteValue: WasmPointer) => number;
  sqlite3_value_numeric_type: (sqliteValue: WasmPointer) => number;
  sqlite3_value_pointer: (
    sqliteValue: WasmPointer,
    type: string | WasmPointer,
  ) => WasmPointer;
  sqlite3_value_subtype: (sqliteValue: WasmPointer) => number;
  sqlite3_value_text: (sqliteValue: WasmPointer) => string;
  sqlite3_value_type: (sqliteValue: WasmPointer) => number;
  sqlite3_value_int64: (sqliteValue: WasmPointer) => BigInt;

  sqlite3_vfs_find: (vfsName: string) => sqlite3_vfs;
  sqlite3_vfs_register: (
    vfs: sqlite3_vfs | WasmPointer,
    makeDflt: number,
  ) => number;
  sqlite3_vfs_unregister: (vfs: sqlite3_vfs | WasmPointer) => number;
  sqlite3_bind_int64: (stmt: WasmPointer, idx: number, value: BigInt) => number;
  sqlite3_changes64: (db: Database | WasmPointer) => BigInt;
  sqlite3_column_int64: (db: Database | WasmPointer, colIdx: number) => BigInt;
  sqlite3_create_module: (
    db: Database | WasmPointer,
    name: string,
    module: WasmPointer | sqlite3_module,
    clientData: WasmPointer,
  ) => number;
  sqlite3_create_module_v2: (
    db: Database | WasmPointer,
    name: string,
    module: WasmPointer | sqlite3_module,
    clientData: WasmPointer,
    destroy?: () => void,
  ) => number;
  sqlite3_declare_vtab: (
    db: Database | WasmPointer,
    sql: string | WasmPointer,
  ) => number;
  sqlite3_deserialize: (
    db: Database | WasmPointer,
    schema: string | WasmPointer,
    data: Uint8Array | Int8Array | ArrayBuffer | WasmPointer,
    dbSize: number,
    bufferSize: number,
    flags: number,
  ) => number;
  sqlite3_drop_modules: (
    db: Database | WasmPointer,
    azKeep: WasmPointer,
  ) => number;
  sqlite3_last_insert_rowid: (db: Database | WasmPointer) => BigInt;
  sqlite3_malloc64: (numBytes: BigInt) => WasmPointer;
  sqlite3_msize: (ptr: WasmPointer) => BigInt;
  sqlite3_overload_function: (
    db: Database | WasmPointer,
    funcName: string,
    nArgs: number,
  ) => number;

  sqlite3_preupdate_blobwrite: (db: Database | WasmPointer) => number;
  sqlite3_preupdate_count: (db: Database | WasmPointer) => number;
  sqlite3_preupdate_depth: (db: Database | WasmPointer) => number;
  sqlite3_preupdate_hook: (
    db: Database | WasmPointer,
    xPreUpdate: (
      ctx: WasmPointer,
      db: WasmPointer,
      op: CAPI['SQLITE_UPDATE'] | CAPI['SQLITE_DELETE'] | CAPI['SQLITE_INSERT'],
      dbName: string,
      tableName: string,
      oldRowid: BigInt,
      newRowid: BigInt,
    ) => void,
  ) => void;
  sqlite3_preupdate_new: (
    db: Database | WasmPointer,
    colIdx: number,
    sqlValues: WasmPointer,
  ) => number;
  sqlite3_preupdate_old: (
    db: Database | WasmPointer,
    colIdx: number,
    sqlValues: WasmPointer,
  ) => number;

  sqlite3_realloc64: (ptr: WasmPointer, numBytes: BigInt) => WasmPointer;
  sqlite3_result_int64: (ctx: WasmPointer, value: BigInt) => void;
  sqlite3_result_zeroblob64: (ctx: WasmPointer, blobLen: BigInt) => void;
  sqlite3_serialize: (
    db: Database | WasmPointer,
    schema: string | WasmPointer,
    piSize: WasmPointer,
    flags: number,
  ) => WasmPointer;
  sqlite3_set_last_insert_rowid: (
    db: Database | WasmPointer,
    rowid: BigInt,
  ) => void;
  sqlite3_status64: (
    op:
      | CAPI['SQLITE_STATUS_MALLOC_COUNT']
      | CAPI['SQLITE_STATUS_MALLOC_SIZE']
      | CAPI['SQLITE_STATUS_PARSER_STACK']
      | CAPI['SQLITE_STATUS_PAGECACHE_USED']
      | CAPI['SQLITE_STATUS_PAGECACHE_OVERFLOW']
      | CAPI['SQLITE_STATUS_PAGECACHE_SIZE']
      | CAPI['SQLITE_STATUS_MEMORY_USED'],
    pCurrent: WasmPointer,
    pHighwater: WasmPointer,
    resetFlag: number,
  ) => number;
  sqlite3_total_changes64: (db: Database | WasmPointer) => BigInt;
  sqlite3_update_hook: (
    db: Database | WasmPointer,
    xUpdate: (
      userCtx: WasmPointer,
      op: CAPI['SQLITE_UPDATE'] | CAPI['SQLITE_DELETE'] | CAPI['SQLITE_INSERT'],
      dbName: string,
      tableName: string,
      newRowId: BigInt,
    ) => void,
    userCtx: WasmPointer,
  ) => void;
  sqlite3_uri_int64: (
    uri: string | WasmPointer,
    paramName: string | WasmPointer,
    defaultVal: BigInt,
  ) => BigInt;

  sqlite3_vtab_collation: (
    indexInfo: sqlite3_index_info | WasmPointer,
    constraintidx: number,
  ) => string;
  sqlite3_vtab_distinct: (
    indexInfo: sqlite3_index_info | WasmPointer,
  ) => number;
  sqlite3_vtab_in: (
    indexInfo: sqlite3_index_info | WasmPointer,
    iCons: number,
    bhandle: number,
  ) => number;
  sqlite3_vtab_in_first: (
    sqlValue: WasmPointer,
    outValues: WasmPointer,
  ) => number;
  sqlite3_vtab_in_next: (
    sqlValue: WasmPointer,
    outValues: WasmPointer,
  ) => number;
  sqlite3_vtab_nochange: (ctx: WasmPointer) => number;
  sqlite3_vtab_on_conflict: (db: Database | WasmPointer) => number;
  sqlite3_vtab_rhs_value: (
    indexInfo: sqlite3_index_info | WasmPointer,
    constraintIdx: number,
    outValues: WasmPointer,
  ) => number;

  sqlite3changegroup_add: (
    changeGrp: WasmPointer,
    nData: number,
    data: WasmPointer,
  ) => number;
  sqlite3changegroup_add_strm: (
    changeGrp: WasmPointer,
    xInput: (
      pIn: WasmPointer,
      pData: WasmPointer,
      pnData: WasmPointer,
    ) => number,
    pIn: WasmPointer,
  ) => number;
  sqlite3changegroup_delete: (changeGrp: WasmPointer) => number;
  sqlite3changegroup_new: (ppOut: WasmPointer) => number;
  sqlite3changegroup_output: (
    changeGrp: WasmPointer,
    pnData: WasmPointer,
    ppData: WasmPointer,
  ) => number;
  sqlite3changegroup_output_strm: (
    changeGrp: WasmPointer,
    xOutput: (pOut: WasmPointer, pData: WasmPointer, nData: number) => number,
    pOut: WasmPointer,
  ) => number;

  sqlite3changeset_apply: (
    db: Database | WasmPointer,
    nChangeset: number,
    pChangeSet: WasmPointer,
    xFilter: ((pCtx: WasmPointer, tableName: string) => number) | WasmPointer,
    xConflict:
      | ((
          pCtx: WasmPointer,
          eConflict: number /* TODO: Can be more specific? */,
        ) =>
          | CAPI['SQLITE_CHANGESET_OMIT']
          | CAPI['SQLITE_CHANGESET_ABORT']
          | CAPI['SQLITE_CHANGESET_REPLACE'])
      | WasmPointer,
    pCtx: WasmPointer,
  ) => number;
  sqlite3changeset_apply_strm: (
    db: Database | WasmPointer,
    xInput:
      | ((pIn: WasmPointer, pData: WasmPointer, pnData: WasmPointer) => number)
      | WasmPointer,
    pIn: WasmPointer,
    xFilter: ((pCtx: WasmPointer, tableName: string) => number) | WasmPointer,
    xConflict:
      | ((
          pCtx: WasmPointer,
          eConflict: number /* TODO: Can be more specific? */,
        ) => number)
      | WasmPointer,
    pCtx: WasmPointer,
  ) => number;
  sqlite3changeset_apply_v2: (
    db: Database | WasmPointer,
    nChangeset: number,
    pChangeset: WasmPointer,
    xFilter: ((pCtx: WasmPointer, tableName: string) => number) | WasmPointer,
    xConflict:
      | ((
          pCtx: WasmPointer,
          eConflict: number /* TODO: Can be more specific? */,
        ) =>
          | CAPI['SQLITE_CHANGESET_OMIT']
          | CAPI['SQLITE_CHANGESET_ABORT']
          | CAPI['SQLITE_CHANGESET_REPLACE'])
      | WasmPointer,
    pCtx: WasmPointer,
    ppRebase: WasmPointer,
    pnRebase: WasmPointer,
    flags: number,
  ) => number;
  sqlite3changeset_apply_v2_strm: (
    db: Database | WasmPointer,
    xInput:
      | ((pIn: WasmPointer, pData: WasmPointer, pnData: WasmPointer) => number)
      | WasmPointer,
    pIn: WasmPointer,
    xFilter: ((pCtx: WasmPointer, tableName: string) => number) | WasmPointer,
    xConflict:
      | ((
          pCtx: WasmPointer,
          eConflict: number /* TODO: Can be more specific? */,
        ) => number)
      | WasmPointer,
    pCtx: WasmPointer,
    ppRebase: WasmPointer,
    pnRebase: WasmPointer,
    flags: number,
  ) => number;
  sqlite3changeset_concat: (
    nA: number,
    pA: WasmPointer,
    nB: number,
    pB: WasmPointer,
    pnOut: WasmPointer,
    ppOut: WasmPointer,
  ) => number;
  sqlite3changeset_concat_strm: (
    xInputA:
      | ((pIn: WasmPointer, pData: WasmPointer, pnData: WasmPointer) => number)
      | WasmPointer,
    pInA: WasmPointer,
    xInputB:
      | ((pIn: WasmPointer, pData: WasmPointer, pnData: WasmPointer) => number)
      | WasmPointer,
    pInB: WasmPointer,
    xOutput:
      | ((pOut: WasmPointer, pData: WasmPointer, nData: number) => number)
      | WasmPointer,
    pOut: WasmPointer,
  ) => number;
  sqlite3changeset_conflict: (
    pIter: WasmPointer,
    colNum: number,
    ppValue: WasmPointer,
  ) => number;
  sqlite3changeset_finalize: (pIter: WasmPointer) => number;
  sqlite3changeset_fk_conflicts: (
    pIter: WasmPointer,
    pnOut: WasmPointer,
  ) => number;
  sqlite3changeset_invert: (
    nIn: number,
    pIn: WasmPointer,
    pnOut: WasmPointer,
    ppOut: WasmPointer,
  ) => number;
  sqlite3changeset_invert_strm: (
    xInput:
      | ((pIn: WasmPointer, pData: WasmPointer, pnData: WasmPointer) => number)
      | WasmPointer,
    pIn: WasmPointer,
    xOutput:
      | ((pOut: WasmPointer, pData: WasmPointer, nData: number) => number)
      | WasmPointer,
    pOut: WasmPointer,
  ) => number;
  sqlite3changeset_new: (
    pIter: WasmPointer,
    colNum: number,
    ppValue: WasmPointer,
  ) => number;
  sqlite3changeset_next: (pIter: WasmPointer) => number;
  sqlite3changeset_old: (
    pIter: WasmPointer,
    colNum: number,
    ppValue: WasmPointer,
  ) => number;
  sqlite3changeset_op: (
    pIter: WasmPointer,
    pzTab: WasmPointer,
    pnCol: WasmPointer,
    pOp: WasmPointer,
    pbIndirect: WasmPointer,
  ) => number;
  sqlite3changeset_pk: (
    pIter: WasmPointer,
    pabPK: WasmPointer,
    pnCol: WasmPointer,
  ) => number;
  sqlite3changeset_start: (
    ppIter: WasmPointer,
    nChangeset: number,
    pChangeset: WasmPointer,
  ) => number;
  sqlite3changeset_start_strm: (
    ppIter: WasmPointer,
    xInput:
      | ((pIn: WasmPointer, pData: WasmPointer, pnData: WasmPointer) => number)
      | WasmPointer,
    pIn: WasmPointer,
  ) => number;
  sqlite3changeset_start_v2: (
    ppIter: WasmPointer,
    nChangeset: number,
    pChangeset: WasmPointer,
    flags: number,
  ) => number;
  sqlite3changeset_start_v2_strm: (
    ppIter: WasmPointer,
    xInput:
      | ((pIn: WasmPointer, pData: WasmPointer, pnData: WasmPointer) => number)
      | WasmPointer,
    pIn: WasmPointer,
    flags: number,
  ) => number;

  sqlite3session_attach: (pSession: WasmPointer, tableName: string) => number;
  sqlite3session_changeset: (
    pSession: WasmPointer,
    pnChangeset: WasmPointer,
    ppChangeset: WasmPointer,
  ) => number;
  sqlite3session_changeset_size: (pSession: WasmPointer) => number;
  sqlite3session_changeset_strm: (
    pSession: WasmPointer,
    xOutput:
      | ((pOut: WasmPointer, pData: WasmPointer, nData: number) => number)
      | WasmPointer,
    pOut: WasmPointer,
  ) => number;
  sqlite3session_config: (
    op: CAPI['SQLITE_SESSION_CONFIG_STRMSIZE'],
    pArg: WasmPointer,
  ) => number;
  sqlite3session_create: (
    db: Database | WasmPointer,
    dbName: string,
    ppSession: WasmPointer,
  ) => number;
  sqlite3session_diff: (
    pSession: WasmPointer,
    fromDb: string,
    tableName: string,
    pzErrMsg: WasmPointer,
  ) => number;
  sqlite3session_enable: (pSession: WasmPointer, bEnable: number) => number;
  sqlite3session_indirect: (pSession: WasmPointer, bIndirect: number) => number;
  sqlite3session_isempty: (pSession: WasmPointer) => number;
  sqlite3session_memory_used: (pSession: WasmPointer) => number;
  sqlite3session_object_config: (pSession: WasmPointer, op: number) => number;
  sqlite3session_patchset: (
    pSession: WasmPointer,
    pnPatchset: WasmPointer,
    ppPatchset: WasmPointer,
  ) => number;
  sqlite3session_patchset_strm: (
    pSession: WasmPointer,
    xOutput:
      | ((pOut: WasmPointer, pData: WasmPointer, nData: number) => number)
      | WasmPointer,
    pOut: WasmPointer,
  ) => number;
  sqlite3session_table_filter: (
    pSession: WasmPointer,
    xFilter: ((pCtx: WasmPointer, tableName: string) => number) | WasmPointer,
    pCtx: WasmPointer,
  ) => void;

  SQLITE_ACCESS_EXISTS: 0;
  SQLITE_ACCESS_READWRITE: 1;
  SQLITE_ACCESS_READ: 2;
  SQLITE_DENY: 1;
  SQLITE_IGNORE: 2;
  SQLITE_CREATE_INDEX: 1;
  SQLITE_CREATE_TABLE: 2;
  SQLITE_CREATE_TEMP_INDEX: 3;
  SQLITE_CREATE_TEMP_TABLE: 4;
  SQLITE_CREATE_TEMP_TRIGGER: 5;
  SQLITE_CREATE_TEMP_VIEW: 6;
  SQLITE_CREATE_TRIGGER: 7;
  SQLITE_CREATE_VIEW: 8;
  SQLITE_DELETE: 9;
  SQLITE_DROP_INDEX: 10;
  SQLITE_DROP_TABLE: 11;
  SQLITE_DROP_TEMP_INDEX: 12;
  SQLITE_DROP_TEMP_TABLE: 13;
  SQLITE_DROP_TEMP_TRIGGER: 14;
  SQLITE_DROP_TEMP_VIEW: 15;
  SQLITE_DROP_TRIGGER: 16;
  SQLITE_DROP_VIEW: 17;
  SQLITE_INSERT: 18;
  SQLITE_PRAGMA: 19;
  SQLITE_READ: 20;
  SQLITE_SELECT: 21;
  SQLITE_TRANSACTION: 22;
  SQLITE_UPDATE: 23;
  SQLITE_ATTACH: 24;
  SQLITE_DETACH: 25;
  SQLITE_ALTER_TABLE: 26;
  SQLITE_REINDEX: 27;
  SQLITE_ANALYZE: 28;
  SQLITE_CREATE_VTABLE: 29;
  SQLITE_DROP_VTABLE: 30;
  SQLITE_FUNCTION: 31;
  SQLITE_SAVEPOINT: 32;
  SQLITE_RECURSIVE: 33;
  SQLITE_STATIC: 0;
  SQLITE_TRANSIENT: -1;
  SQLITE_WASM_DEALLOC: 1;
  SQLITE_CHANGESETSTART_INVERT: 2;
  SQLITE_CHANGESETAPPLY_NOSAVEPOINT: 1;
  SQLITE_CHANGESETAPPLY_INVERT: 2;
  SQLITE_CHANGESET_DATA: 1;
  SQLITE_CHANGESET_NOTFOUND: 2;
  SQLITE_CHANGESET_CONFLICT: 3;
  SQLITE_CHANGESET_CONSTRAINT: 4;
  SQLITE_CHANGESET_FOREIGN_KEY: 5;
  SQLITE_CHANGESET_OMIT: 0;
  SQLITE_CHANGESET_REPLACE: 1;
  SQLITE_CHANGESET_ABORT: 2;
  SQLITE_CONFIG_SINGLETHREAD: 1;
  SQLITE_CONFIG_MULTITHREAD: 2;
  SQLITE_CONFIG_SERIALIZED: 3;
  SQLITE_CONFIG_MALLOC: 4;
  SQLITE_CONFIG_GETMALLOC: 5;
  SQLITE_CONFIG_SCRATCH: 6;
  SQLITE_CONFIG_PAGECACHE: 7;
  SQLITE_CONFIG_HEAP: 8;
  SQLITE_CONFIG_MEMSTATUS: 9;
  SQLITE_CONFIG_MUTEX: 10;
  SQLITE_CONFIG_GETMUTEX: 11;
  SQLITE_CONFIG_LOOKASIDE: 13;
  SQLITE_CONFIG_PCACHE: 14;
  SQLITE_CONFIG_GETPCACHE: 15;
  SQLITE_CONFIG_LOG: 16;
  SQLITE_CONFIG_URI: 17;
  SQLITE_CONFIG_PCACHE2: 18;
  SQLITE_CONFIG_GETPCACHE2: 19;
  SQLITE_CONFIG_COVERING_INDEX_SCAN: 20;
  SQLITE_CONFIG_SQLLOG: 21;
  SQLITE_CONFIG_MMAP_SIZE: 22;
  SQLITE_CONFIG_WIN32_HEAPSIZE: 23;
  SQLITE_CONFIG_PCACHE_HDRSZ: 24;
  SQLITE_CONFIG_PMASZ: 25;
  SQLITE_CONFIG_STMTJRNL_SPILL: 26;
  SQLITE_CONFIG_SMALL_MALLOC: 27;
  SQLITE_CONFIG_SORTERREF_SIZE: 28;
  SQLITE_CONFIG_MEMDB_MAXSIZE: 29;
  SQLITE_INTEGER: 1;
  SQLITE_FLOAT: 2;
  SQLITE_TEXT: 3;
  SQLITE_BLOB: 4;
  SQLITE_NULL: 5;
  SQLITE_DBCONFIG_MAINDBNAME: 1000;
  SQLITE_DBCONFIG_LOOKASIDE: 1001;
  SQLITE_DBCONFIG_ENABLE_FKEY: 1002;
  SQLITE_DBCONFIG_ENABLE_TRIGGER: 1003;
  SQLITE_DBCONFIG_ENABLE_FTS3_TOKENIZER: 1004;
  SQLITE_DBCONFIG_ENABLE_LOAD_EXTENSION: 1005;
  SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE: 1006;
  SQLITE_DBCONFIG_ENABLE_QPSG: 1007;
  SQLITE_DBCONFIG_TRIGGER_EQP: 1008;
  SQLITE_DBCONFIG_RESET_DATABASE: 1009;
  SQLITE_DBCONFIG_DEFENSIVE: 1010;
  SQLITE_DBCONFIG_WRITABLE_SCHEMA: 1011;
  SQLITE_DBCONFIG_LEGACY_ALTER_TABLE: 1012;
  SQLITE_DBCONFIG_DQS_DML: 1013;
  SQLITE_DBCONFIG_DQS_DDL: 1014;
  SQLITE_DBCONFIG_ENABLE_VIEW: 1015;
  SQLITE_DBCONFIG_LEGACY_FILE_FORMAT: 1016;
  SQLITE_DBCONFIG_TRUSTED_SCHEMA: 1017;
  SQLITE_DBCONFIG_MAX: 1019;
  SQLITE_DBSTATUS_LOOKASIDE_USED: 0;
  SQLITE_DBSTATUS_CACHE_USED: 1;
  SQLITE_DBSTATUS_SCHEMA_USED: 2;
  SQLITE_DBSTATUS_STMT_USED: 3;
  SQLITE_DBSTATUS_LOOKASIDE_HIT: 4;
  SQLITE_DBSTATUS_LOOKASIDE_MISS_SIZE: 5;
  SQLITE_DBSTATUS_LOOKASIDE_MISS_FULL: 6;
  SQLITE_DBSTATUS_CACHE_HIT: 7;
  SQLITE_DBSTATUS_CACHE_MISS: 8;
  SQLITE_DBSTATUS_CACHE_WRITE: 9;
  SQLITE_DBSTATUS_DEFERRED_FKS: 10;
  SQLITE_DBSTATUS_CACHE_USED_SHARED: 11;
  SQLITE_DBSTATUS_CACHE_SPILL: 12;
  SQLITE_DBSTATUS_MAX: 12;
  SQLITE_UTF8: 1;
  SQLITE_UTF16LE: 2;
  SQLITE_UTF16BE: 3;
  SQLITE_UTF16: 4;
  SQLITE_UTF16_ALIGNED: 8;
  SQLITE_FCNTL_LOCKSTATE: 1;
  SQLITE_FCNTL_GET_LOCKPROXYFILE: 2;
  SQLITE_FCNTL_SET_LOCKPROXYFILE: 3;
  SQLITE_FCNTL_LAST_ERRNO: 4;
  SQLITE_FCNTL_SIZE_HINT: 5;
  SQLITE_FCNTL_CHUNK_SIZE: 6;
  SQLITE_FCNTL_FILE_POINTER: 7;
  SQLITE_FCNTL_SYNC_OMITTED: 8;
  SQLITE_FCNTL_WIN32_AV_RETRY: 9;
  SQLITE_FCNTL_PERSIST_WAL: 10;
  SQLITE_FCNTL_OVERWRITE: 11;
  SQLITE_FCNTL_VFSNAME: 12;
  SQLITE_FCNTL_POWERSAFE_OVERWRITE: 13;
  SQLITE_FCNTL_PRAGMA: 14;
  SQLITE_FCNTL_BUSYHANDLER: 15;
  SQLITE_FCNTL_TEMPFILENAME: 16;
  SQLITE_FCNTL_MMAP_SIZE: 18;
  SQLITE_FCNTL_TRACE: 19;
  SQLITE_FCNTL_HAS_MOVED: 20;
  SQLITE_FCNTL_SYNC: 21;
  SQLITE_FCNTL_COMMIT_PHASETWO: 22;
  SQLITE_FCNTL_WIN32_SET_HANDLE: 23;
  SQLITE_FCNTL_WAL_BLOCK: 24;
  SQLITE_FCNTL_ZIPVFS: 25;
  SQLITE_FCNTL_RBU: 26;
  SQLITE_FCNTL_VFS_POINTER: 27;
  SQLITE_FCNTL_JOURNAL_POINTER: 28;
  SQLITE_FCNTL_WIN32_GET_HANDLE: 29;
  SQLITE_FCNTL_PDB: 30;
  SQLITE_FCNTL_BEGIN_ATOMIC_WRITE: 31;
  SQLITE_FCNTL_COMMIT_ATOMIC_WRITE: 32;
  SQLITE_FCNTL_ROLLBACK_ATOMIC_WRITE: 33;
  SQLITE_FCNTL_LOCK_TIMEOUT: 34;
  SQLITE_FCNTL_DATA_VERSION: 35;
  SQLITE_FCNTL_SIZE_LIMIT: 36;
  SQLITE_FCNTL_CKPT_DONE: 37;
  SQLITE_FCNTL_RESERVE_BYTES: 38;
  SQLITE_FCNTL_CKPT_START: 39;
  SQLITE_FCNTL_EXTERNAL_READER: 40;
  SQLITE_FCNTL_CKSM_FILE: 41;
  SQLITE_LOCK_NONE: 0;
  SQLITE_LOCK_SHARED: 1;
  SQLITE_LOCK_RESERVED: 2;
  SQLITE_LOCK_PENDING: 3;
  SQLITE_LOCK_EXCLUSIVE: 4;
  SQLITE_IOCAP_ATOMIC: 1;
  SQLITE_IOCAP_ATOMIC512: 2;
  SQLITE_IOCAP_ATOMIC1K: 4;
  SQLITE_IOCAP_ATOMIC2K: 8;
  SQLITE_IOCAP_ATOMIC4K: 16;
  SQLITE_IOCAP_ATOMIC8K: 32;
  SQLITE_IOCAP_ATOMIC16K: 64;
  SQLITE_IOCAP_ATOMIC32K: 128;
  SQLITE_IOCAP_ATOMIC64K: 256;
  SQLITE_IOCAP_SAFE_APPEND: 512;
  SQLITE_IOCAP_SEQUENTIAL: 1024;
  SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN: 2048;
  SQLITE_IOCAP_POWERSAFE_OVERWRITE: 4096;
  SQLITE_IOCAP_IMMUTABLE: 8192;
  SQLITE_IOCAP_BATCH_ATOMIC: 16384;
  SQLITE_MAX_ALLOCATION_SIZE: 536870911;
  SQLITE_LIMIT_LENGTH: 0;
  SQLITE_MAX_LENGTH: 1000000000;
  SQLITE_LIMIT_SQL_LENGTH: 1;
  SQLITE_MAX_SQL_LENGTH: 1000000000;
  SQLITE_LIMIT_COLUMN: 2;
  SQLITE_MAX_COLUMN: 2000;
  SQLITE_LIMIT_EXPR_DEPTH: 3;
  SQLITE_MAX_EXPR_DEPTH: 1000;
  SQLITE_LIMIT_COMPOUND_SELECT: 4;
  SQLITE_MAX_COMPOUND_SELECT: 500;
  SQLITE_LIMIT_VDBE_OP: 5;
  SQLITE_MAX_VDBE_OP: 250000000;
  SQLITE_LIMIT_FUNCTION_ARG: 6;
  SQLITE_MAX_FUNCTION_ARG: 127;
  SQLITE_LIMIT_ATTACHED: 7;
  SQLITE_MAX_ATTACHED: 10;
  SQLITE_LIMIT_LIKE_PATTERN_LENGTH: 8;
  SQLITE_MAX_LIKE_PATTERN_LENGTH: 50000;
  SQLITE_LIMIT_VARIABLE_NUMBER: 9;
  SQLITE_MAX_VARIABLE_NUMBER: 32766;
  SQLITE_LIMIT_TRIGGER_DEPTH: 10;
  SQLITE_MAX_TRIGGER_DEPTH: 1000;
  SQLITE_LIMIT_WORKER_THREADS: 11;
  SQLITE_MAX_WORKER_THREADS: 0;
  SQLITE_OPEN_READONLY: 1;
  SQLITE_OPEN_READWRITE: 2;
  SQLITE_OPEN_CREATE: 4;
  SQLITE_OPEN_URI: 64;
  SQLITE_OPEN_MEMORY: 128;
  SQLITE_OPEN_NOMUTEX: 32768;
  SQLITE_OPEN_FULLMUTEX: 65536;
  SQLITE_OPEN_SHAREDCACHE: 131072;
  SQLITE_OPEN_PRIVATECACHE: 262144;
  SQLITE_OPEN_EXRESCODE: 33554432;
  SQLITE_OPEN_NOFOLLOW: 16777216;
  SQLITE_OPEN_MAIN_DB: 256;
  SQLITE_OPEN_MAIN_JOURNAL: 2048;
  SQLITE_OPEN_TEMP_DB: 512;
  SQLITE_OPEN_TEMP_JOURNAL: 4096;
  SQLITE_OPEN_TRANSIENT_DB: 1024;
  SQLITE_OPEN_SUBJOURNAL: 8192;
  SQLITE_OPEN_SUPER_JOURNAL: 16384;
  SQLITE_OPEN_WAL: 524288;
  SQLITE_OPEN_DELETEONCLOSE: 8;
  SQLITE_OPEN_EXCLUSIVE: 16;
  SQLITE_PREPARE_PERSISTENT: 1;
  SQLITE_PREPARE_NORMALIZE: 2;
  SQLITE_PREPARE_NO_VTAB: 4;
  SQLITE_OK: 0;
  SQLITE_ERROR: 1;
  SQLITE_INTERNAL: 2;
  SQLITE_PERM: 3;
  SQLITE_ABORT: 4;
  SQLITE_BUSY: 5;
  SQLITE_LOCKED: 6;
  SQLITE_NOMEM: 7;
  SQLITE_READONLY: 8;
  SQLITE_INTERRUPT: 9;
  SQLITE_IOERR: 10;
  SQLITE_CORRUPT: 11;
  SQLITE_NOTFOUND: 12;
  SQLITE_FULL: 13;
  SQLITE_CANTOPEN: 14;
  SQLITE_PROTOCOL: 15;
  SQLITE_EMPTY: 16;
  SQLITE_SCHEMA: 17;
  SQLITE_TOOBIG: 18;
  SQLITE_CONSTRAINT: 19;
  SQLITE_MISMATCH: 20;
  SQLITE_MISUSE: 21;
  SQLITE_NOLFS: 22;
  SQLITE_AUTH: 23;
  SQLITE_FORMAT: 24;
  SQLITE_RANGE: 25;
  SQLITE_NOTADB: 26;
  SQLITE_NOTICE: 27;
  SQLITE_WARNING: 28;
  SQLITE_ROW: 100;
  SQLITE_DONE: 101;
  SQLITE_ERROR_MISSING_COLLSEQ: 257;
  SQLITE_ERROR_RETRY: 513;
  SQLITE_ERROR_SNAPSHOT: 769;
  SQLITE_IOERR_READ: 266;
  SQLITE_IOERR_SHORT_READ: 522;
  SQLITE_IOERR_WRITE: 778;
  SQLITE_IOERR_FSYNC: 1034;
  SQLITE_IOERR_DIR_FSYNC: 1290;
  SQLITE_IOERR_TRUNCATE: 1546;
  SQLITE_IOERR_FSTAT: 1802;
  SQLITE_IOERR_UNLOCK: 2058;
  SQLITE_IOERR_RDLOCK: 2314;
  SQLITE_IOERR_DELETE: 2570;
  SQLITE_IOERR_BLOCKED: 2826;
  SQLITE_IOERR_NOMEM: 3082;
  SQLITE_IOERR_ACCESS: 3338;
  SQLITE_IOERR_CHECKRESERVEDLOCK: 3594;
  SQLITE_IOERR_LOCK: 3850;
  SQLITE_IOERR_CLOSE: 4106;
  SQLITE_IOERR_DIR_CLOSE: 4362;
  SQLITE_IOERR_SHMOPEN: 4618;
  SQLITE_IOERR_SHMSIZE: 4874;
  SQLITE_IOERR_SHMLOCK: 5130;
  SQLITE_IOERR_SHMMAP: 5386;
  SQLITE_IOERR_SEEK: 5642;
  SQLITE_IOERR_DELETE_NOENT: 5898;
  SQLITE_IOERR_MMAP: 6154;
  SQLITE_IOERR_GETTEMPPATH: 6410;
  SQLITE_IOERR_CONVPATH: 6666;
  SQLITE_IOERR_VNODE: 6922;
  SQLITE_IOERR_AUTH: 7178;
  SQLITE_IOERR_BEGIN_ATOMIC: 7434;
  SQLITE_IOERR_COMMIT_ATOMIC: 7690;
  SQLITE_IOERR_ROLLBACK_ATOMIC: 7946;
  SQLITE_IOERR_DATA: 8202;
  SQLITE_IOERR_CORRUPTFS: 8458;
  SQLITE_LOCKED_SHAREDCACHE: 262;
  SQLITE_LOCKED_VTAB: 518;
  SQLITE_BUSY_RECOVERY: 261;
  SQLITE_BUSY_SNAPSHOT: 517;
  SQLITE_BUSY_TIMEOUT: 773;
  SQLITE_CANTOPEN_NOTEMPDIR: 270;
  SQLITE_CANTOPEN_ISDIR: 526;
  SQLITE_CANTOPEN_FULLPATH: 782;
  SQLITE_CANTOPEN_CONVPATH: 1038;
  SQLITE_CANTOPEN_SYMLINK: 1550;
  SQLITE_CORRUPT_VTAB: 267;
  SQLITE_CORRUPT_SEQUENCE: 523;
  SQLITE_CORRUPT_INDEX: 779;
  SQLITE_READONLY_RECOVERY: 264;
  SQLITE_READONLY_CANTLOCK: 520;
  SQLITE_READONLY_ROLLBACK: 776;
  SQLITE_READONLY_DBMOVED: 1032;
  SQLITE_READONLY_CANTINIT: 1288;
  SQLITE_READONLY_DIRECTORY: 1544;
  SQLITE_ABORT_ROLLBACK: 516;
  SQLITE_CONSTRAINT_CHECK: 275;
  SQLITE_CONSTRAINT_COMMITHOOK: 531;
  SQLITE_CONSTRAINT_FOREIGNKEY: 787;
  SQLITE_CONSTRAINT_FUNCTION: 1043;
  SQLITE_CONSTRAINT_NOTNULL: 1299;
  SQLITE_CONSTRAINT_PRIMARYKEY: 1555;
  SQLITE_CONSTRAINT_TRIGGER: 1811;
  SQLITE_CONSTRAINT_UNIQUE: 2067;
  SQLITE_CONSTRAINT_VTAB: 2323;
  SQLITE_CONSTRAINT_ROWID: 2579;
  SQLITE_CONSTRAINT_PINNED: 2835;
  SQLITE_CONSTRAINT_DATATYPE: 3091;
  SQLITE_NOTICE_RECOVER_WAL: 283;
  SQLITE_NOTICE_RECOVER_ROLLBACK: 539;
  SQLITE_WARNING_AUTOINDEX: 284;
  SQLITE_AUTH_USER: 279;
  SQLITE_OK_LOAD_PERMANENTLY: 256;
  SQLITE_STATUS_MEMORY_USED: 0;
  SQLITE_STATUS_PAGECACHE_USED: 1;
  SQLITE_STATUS_PAGECACHE_OVERFLOW: 2;
  SQLITE_STATUS_MALLOC_SIZE: 5;
  SQLITE_STATUS_PARSER_STACK: 6;
  SQLITE_STATUS_PAGECACHE_SIZE: 7;
  SQLITE_STATUS_MALLOC_COUNT: 9;
  SQLITE_STMTSTATUS_FULLSCAN_STEP: 1;
  SQLITE_STMTSTATUS_SORT: 2;
  SQLITE_STMTSTATUS_AUTOINDEX: 3;
  SQLITE_STMTSTATUS_VM_STEP: 4;
  SQLITE_STMTSTATUS_REPREPARE: 5;
  SQLITE_STMTSTATUS_RUN: 6;
  SQLITE_STMTSTATUS_FILTER_MISS: 7;
  SQLITE_STMTSTATUS_FILTER_HIT: 8;
  SQLITE_STMTSTATUS_MEMUSED: 99;
  SQLITE_SYNC_NORMAL: 2;
  SQLITE_SYNC_FULL: 3;
  SQLITE_SYNC_DATAONLY: 16;
  SQLITE_TRACE_STMT: 1;
  SQLITE_TRACE_PROFILE: 2;
  SQLITE_TRACE_ROW: 4;
  SQLITE_TRACE_CLOSE: 8;
  SQLITE_TXN_NONE: 0;
  SQLITE_TXN_READ: 1;
  SQLITE_TXN_WRITE: 2;
  SQLITE_DETERMINISTIC: 2048;
  SQLITE_DIRECTONLY: 524288;
  SQLITE_INNOCUOUS: 2097152;
  SQLITE_VERSION_NUMBER: 3043000;
  SQLITE_VERSION: string;
  SQLITE_SOURCE_ID: string;
  SQLITE_SERIALIZE_NOCOPY: 1;
  SQLITE_DESERIALIZE_FREEONCLOSE: 1;
  SQLITE_DESERIALIZE_READONLY: 4;
  SQLITE_DESERIALIZE_RESIZEABLE: 2;
  SQLITE_SESSION_CONFIG_STRMSIZE: 1;
  SQLITE_SESSION_OBJCONFIG_SIZE: 1;
  SQLITE_INDEX_SCAN_UNIQUE: 1;
  SQLITE_INDEX_CONSTRAINT_EQ: 2;
  SQLITE_INDEX_CONSTRAINT_GT: 4;
  SQLITE_INDEX_CONSTRAINT_LE: 8;
  SQLITE_INDEX_CONSTRAINT_LT: 16;
  SQLITE_INDEX_CONSTRAINT_GE: 32;
  SQLITE_INDEX_CONSTRAINT_MATCH: 64;
  SQLITE_INDEX_CONSTRAINT_LIKE: 65;
  SQLITE_INDEX_CONSTRAINT_GLOB: 66;
  SQLITE_INDEX_CONSTRAINT_REGEXP: 67;
  SQLITE_INDEX_CONSTRAINT_NE: 68;
  SQLITE_INDEX_CONSTRAINT_ISNOT: 69;
  SQLITE_INDEX_CONSTRAINT_ISNOTNULL: 70;
  SQLITE_INDEX_CONSTRAINT_ISNULL: 71;
  SQLITE_INDEX_CONSTRAINT_IS: 72;
  SQLITE_INDEX_CONSTRAINT_LIMIT: 73;
  SQLITE_INDEX_CONSTRAINT_OFFSET: 74;
  SQLITE_INDEX_CONSTRAINT_FUNCTION: 150;
  SQLITE_VTAB_CONSTRAINT_SUPPORT: 1;
  SQLITE_VTAB_INNOCUOUS: 2;
  SQLITE_VTAB_DIRECTONLY: 3;
  SQLITE_ROLLBACK: 1;
  SQLITE_FAIL: 3;
  SQLITE_REPLACE: 5;
  sqlite3_js_rc_str: (rc: number) => string;
  sqlite3_close_v2: (db: Database | WasmPointer) => number;
  sqlite3session_delete: (
    pSession: WasmPointer,
  ) => number;
  sqlite3_create_collation_v2: (
    db: Database | WasmPointer,
    zName: string,
    eTextRep: number,
    pArg: WasmPointer,
    xCompare: ((pCtx: WasmPointer, len1: number, p1: WasmPointer, len2: number, p2: WasmPointer) => number) | WasmPointer,
    xDestroy: ((pCtx: WasmPointer) => void) | WasmPointer,
  ) => number;
  sqlite3_create_collation: (
    db: Database | WasmPointer,
    zName: string,
    eTextRep: number,
    pArg: WasmPointer,
    xCompare: ((pCtx: WasmPointer, len1: number, p1: WasmPointer, len2: number, p2: WasmPointer) => number) | WasmPointer,
  ) => number;
  sqlite3_config: (
    op: number,
    args: any,
  ) => number;
  sqlite3_auto_extension: (
    xEntryPoint: ((
      db: Database | WasmPointer,
      pzErrMsg: WasmPointer,
      pThunk:  WasmPointer
    ) => number) | WasmPointer,
  ) => number;
  sqlite3_cancel_auto_extension: (
    xEntryPoint: ((
      db: Database | WasmPointer,
      pzErrMsg: WasmPointer,
      pThunk:  WasmPointer
    ) => number) | WasmPointer,
  ) => number;
  sqlite3_reset_auto_extension: () => void;
};
