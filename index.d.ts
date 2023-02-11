type GetPromise = ((...args: any[]) => Promise<any>) | { promise: (...args: any[]) => Promise<any> }
type BuilderUtils = {
	promise(...args: any[]): Promise<any>,
	allow(...codes: number[]): BuilderUtils,
	cache(ms: number): BuilderUtils,
	debounce(ms: number): BuilderUtils,
	retries(n: number): BuilderUtils,
	throttle(n: number, ms: number): BuilderUtils
}
type DagUtils = {
	promise(): Promise<any>
	add(builder: GetPromise, ...dependencies: any[]): DagUtils
}
declare module "async-sugar" {
	const builder: (getPromise: GetPromise) => BuilderUtils
	const dag: () => DagUtils
}