# async-sugar
Welcome to the `async-sugar` library!
## Installation
```
npm i -D async-sugar
```
## types
```typescript
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
	const request: (input: string) => RequestUtils
}
```

## Usage

### Builder
```javascript
import { builder } from "async-sugar"

const sleep = (ms) => new Promise(resolve => setTimeout(() => resolve(), ms))
const sleepEcho = (value, ms) => new Promise(resolve => setTimeout(() => resolve(value), ms))
const errorEcho = (value) => new Promise((_, reject) => reject(value))
;(async () => {
	let time = 0
	setInterval(() => {
		time += 10
	}, 10);
	const printThen = value => console.log("then:", time + "ms", value)
	const printCatch = error => console.log("catch:", time + "ms", error)

	console.log("\n inProgressTest")
	const inProgressTest = builder(v => sleepEcho(v, 100))
	inProgressTest.promise("1st")
		.then(printThen)
	inProgressTest.promise("2nd")
		.catch(printCatch) // 102 Error
	await sleep(500)
	time = 0

	console.log("\n debounceTest")
	const debounceTest = builder(v => sleepEcho(v, 100))
		.debounce(100)
	debounceTest.promise("3rd")
		.catch(printCatch) // 409 Error
	debounceTest.promise("4th")
		.then(printThen)
	await sleep(500)
	time = 0
	
	console.log("\n retryTest")
	const retryTest = builder((() => {
		let count = 4
		return () => (++count % 4 ? errorEcho : sleepEcho)(count + "th", 100)
	})())
		.retries(3)
	await retryTest.promise()
		.then(printThen) // success after 3 retries
	await sleep(500)
	time = 0

	console.log("\n throttleTest")
	const throttleTest = builder(v => v)
		.throttle(2, 100)
	throttleTest.promise("9th").then(printThen)
	await sleep(0)
	throttleTest.promise("10th").then(printThen)
	await sleep(0)
	throttleTest.promise("11th").catch(printCatch) // 429 Error
	await sleep(500)
	time = 0

	console.log("\n cacheTest")
	const cacheTest = builder(v => v)
		.cache(100)
	cacheTest.promise("12th").then(printThen)
	await sleep(40)
	cacheTest.promise("13th").then(printThen)
	await sleep(40)
	cacheTest.promise("14th").then(printThen)
	await sleep(40)
	cacheTest.promise("15th").then(printThen)
	await sleep(500)
	time = 0

	console.log("\n allow102Test")
	const allow102Test = builder(v => sleepEcho(v, 100))
		.allow(102)
	allow102Test.promise("16th").then(printThen)
	allow102Test.promise("17th").then(printThen)
	await sleep(500)
	time = 0

	console.log("\n allow409Test")
	const allow409Test = builder(v => sleepEcho(v, 100))
		.debounce(100)
		.allow(409)
	allow409Test.promise("18th").then(printThen)
	allow409Test.promise("19th").then(printThen)
	await sleep(500)
	time = 0

	console.log("\n allow429Test")
	const allow429Test = builder(v => v)
		.throttle(1, 100)
		.allow(429)
	allow429Test.promise("20th").then(printThen)
	await sleep(0)
	allow429Test.promise("21st").then(printThen)
})()
```
console.log
```javascript
 inProgressTest
then: 100ms 1st
catch: 100ms {code: 102, message: "Async request already in progress", value: "1st"}

 debounceTest
then: 200ms 4th
catch: 200ms {code: 409, message: "Async request be debounced", value: "4th"}

 retryTest
then: 100ms 8th

 throttleTest
then: 0ms 9th
then: 0ms 10th
catch: 0ms {code: 429, message: "Too many requests", value: "10th"}

 cacheTest
then: 0ms 12th
then: 40ms 12th
then: 90ms 12th
then: 140ms 15th

 allow102Test
then: 100ms 16th
then: 100ms 16th

 allow409Test
then: 200ms 19th
then: 200ms 19th

 allow429Test
then: 0ms 20th
then: 10ms 20th
```
### Dag
```javascript
import { builder, dag } from "async-sugar"

const sleep = (ms) => new Promise(resolve => setTimeout(() => resolve(), ms))
const sleepEcho = (value, ms) => new Promise(resolve => setTimeout(() => resolve(value), ms))
;(async () => {
	let time = 0
	setInterval(() => {
		time += 10
	}, 10);

	const a = builder(v => sleepEcho(v, 100))
	const b = builder(v => sleepEcho(v, 200))
	const c = builder((a, b) => sleepEcho(a + b, 100))
	const d = builder(v => sleepEcho(v, 400))
	const e = builder((c, d) => sleepEcho(c + d, 100))
	const abcdeDag = dag()
		.add(a, "a") // a
		.add(b, "b") // b
		.add(c, a, b) // a + b = ab
		.add(d, "d") // d
		.add(e, c, d) // ab + d = abd

	const x = builder(v => sleepEcho(v, 100))
	const y = builder(v => sleepEcho(v, 200))
	const z = builder((x, y) => sleepEcho(x + y, 200))
	const xyzDag = dag()
		.add(x, "x") // x
		.add(y, "y") // y
		.add(z, x, y) // x + y = xy
	
	const abcdexyz = (abcde, xyz) => sleepEcho(abcde + xyz, 200)
	const abcdexyzDag = dag()
		.add(abcdeDag) // abcdeDag.promise()
		.add(xyzDag) // xyzDag.promise()
		.add(abcdexyz, abcdeDag, xyzDag) // abd + xy = abdxy
		
	const dagApi = builder(abcdexyzDag).debounce(500)
	
	dagApi.promise().catch(err => console.log(err, time)) // 409 Error
	dagApi.promise().then(res => console.log(res, time)) // log when 1200
	dagApi.debounce(0)
	dagApi.promise().then(res => console.log(res, time)) // log when 700

	const now = builder(() => sleepEcho(Date.now(), 100))
	const nowDag = dag().add(now)
	console.log(await nowDag.promise(), time) // log when 100
	console.log(await nowDag.promise(), time) // log when 200
	console.log(await nowDag.promise(), time) // log when 300
	console.log(await nowDag.promise(), time) // log when 400
})()
```
console.log
```javascript
1676258762947 100
1676258763049 200
1676258763154 300
1676258763258 410
abdxy 700
abdxy 1200
{
	code: 409,
	message: "Async request be debounced",
	value: "abdxy"
} 1200
```
### Request
```javascript
import { request } from "async-sugar"

;(async () => {
	let time = 0
	setInterval(() => {
		time += 10
	}, 10);

	let response
	/* args to query: ?a=1&b%5B0%5D=1&b%5B1%5D=2&b%5B2%5D=3&c=6&d.e%5B0%5D=a&d.e%5B1%5D=b&d.e%5B2%5D=c */
	const get = request('https://jsonplaceholder.typicode.com/posts')
	response = await get.get({a:1, b:[1,2,3], c:6, d: { e: ["a", "b", "c"]}})
		.then(response => response.json())
		.then(data => console.log("get:", time + "ms", data))
	/* args to body */
	const post = request('https://jsonplaceholder.typicode.com/posts?_delay=1500')
	await post.timeout(1000).method("POST", {a:1, b:[1,2,3], c:6, d: { e: ["a", "b", "c"]}})
		.catch(error => console.log("catch:", time + "ms", error)) // abort after 1s
	await post.timeout(0).method("POST", {a:1, b:[1,2,3], c:6, d: { e: ["a", "b", "c"]}})
		.then(response => response.json())
		.then(data => console.log("get:", time + "ms", data))
})()
```
console.log
```javascript
get: 490ms (100) [{…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}]
catch: 1490ms DOMException: The user aborted a request.
get: 3900ms {a: 1, b: Array(3), c: 6, d: {…}, id: 101}
```
I hope you find this library useful! Let me know if you have any questions or suggestions.