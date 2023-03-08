type GetPromise = ((...args: any[]) => Promise<any>) | { promise: (...args: any[]) => Promise<any> }
type BuilderUtils = {
	promise(...args: any[]): Promise<any>
	allow(...codes: number[]): BuilderUtils
	cache(ms: number): BuilderUtils
	debounce(ms: number): BuilderUtils
	retries(n: number): BuilderUtils
	throttle(n: number, ms: number): BuilderUtils
}
type DagUtils = {
	promise(): Promise<any>
	add(builder: GetPromise, ...dependencies: any[]): DagUtils
}
type RequestUtils = {
	get(args?: { [ k: string ]: any }): Promise<Response>
	method(method: string, args?: JSON): Promise<Response>
	mode(value?): RequestUtils
	cache(value?): RequestUtils
	credentials(value?): RequestUtils
	headers(headers?: JSON): RequestUtils
	redirect(value?): RequestUtils
	referrerPolicy(value?): RequestUtils
	timeout(ms?): RequestUtils
}
declare module "async-sugar" {
	const builder: (getPromise: GetPromise) => BuilderUtils
	const dag: () => DagUtils
	const request: (input: string, initHeaders?: JSON) => RequestUtils
}