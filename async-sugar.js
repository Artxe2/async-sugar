const builder = getPromise => {
	getPromise = getPromise.promise || getPromise

	let currentPromise/* Promise */
	let inProgress/* Promise */

	let allow429Error/* boolean */
	let allow409Error/* boolean */
	let allow102Error/* boolean */
	const allow = (...codes) => {
		allow429Error = codes.includes(429)
		allow409Error = codes.includes(409)
		allow102Error = codes.includes(102)
		return utils
	}

	let cacheTimeMs = 0
	const cache = ms => {
		cacheTimeMs = ms
		return utils
	}
	let cachedValue/* any */

	let throttleLimit = 0
	let throttleTimeMs = 0
	const throttle = (n, ms) => {
		throttleLimit = n
		throttleTimeMs = ms
		return utils
	}
	let throttleCount = 0
	let throttlePromise/* Promise */
	const throttleImpl = async args => {
		if (!throttleLimit || throttleCount < throttleLimit) {
			if (throttleLimit) {
				throttleCount++
				setTimeout(() => {
					throttleCount--
					throttlePromise = null
				}, throttleTimeMs)
			}
			throttlePromise = getPromise(...args)
			return throttlePromise
		}
		return allow429Error
			? throttlePromise
			: Promise.reject({
				code: 429,
				message: "Too many requests",
				value: await throttlePromise
			})
	}

	let numberOfRetries = 0
	const retries = n => {
		numberOfRetries = n
		return utils
	}
	const retriesImpl = (args, resolve, reject, retry) => {
		throttleImpl(args)
			.then(value => {
				if (cacheTimeMs) {
					cachedValue = value
					setTimeout(
						() => cachedValue = null,
						cacheTimeMs
					)
				}
				inProgress = null
				resolve(value)
			})
			.catch(reason => {
				if (retry < numberOfRetries) {
					retriesImpl(args, resolve, reject, retry + 1)
				} else {
					inProgress = null
					reject(reason)
				}
			})
	}

	let debounceTimeMs = 0
	const debounce = ms => {
		debounceTimeMs = ms
		return utils
	}
	let debouncePromise/* Promise */
	const debounceImpl = (args, resolve, reject) => {
		if (debounceTimeMs) {
			const promise = currentPromise
			debouncePromise = currentPromise
			setTimeout(async () => {
				if (debouncePromise !== promise) {
					allow409Error
						? resolve(debouncePromise)
						: reject({
							code: 409,
							message: "Async request be debounced",
							value: await debouncePromise
						})
				} else {
					debouncePromise = null
					inProgress = promise
					retriesImpl(args, resolve, reject, 0)
				}
			}, debounceTimeMs)
		} else {
			inProgress = currentPromise
			retriesImpl(args, resolve, reject, 0)
		}
	}

	const promise = async (...args) => {
		if (cachedValue) {
			return cachedValue
		}
		let resolve
		let reject
		currentPromise = new Promise((res, rej) => {
			resolve = res
			reject = rej
		})
		if (inProgress) {
			allow102Error
				? resolve(inProgress)
				: reject({
					code: 102,
					message: "Async request already in progress",
					value: await inProgress
				})
		} else {
			debounceImpl(args, resolve, reject)
		}
		return currentPromise
	}
	const utils = {
		promise,
		allow,
		cache,
		debounce,
		retries,
		throttle
	}
	return utils
}

const _isFunction = p => typeof p === "function"
const _next = async (resolve, reject, tasks, dependents, count, dependencies, getPromise) => {
	const promise = dependencies.length
		? getPromise(...(await Promise.all(dependencies)))
		: getPromise()
	promise
		.then(value => {
			tasks.set(dependencies, value)
			if (!--count[0]) {
				resolve([...tasks.values()].pop())
			}
			const queue = dependents.get(getPromise)
			if (queue) {
				for (const p of queue) {
					p[p.indexOf(getPromise)] = value
					if (p.every(p => !_isFunction(p))) {
						_next(resolve, reject, tasks, dependents, count, p, tasks.get(p))
							.catch(reason => reject(reason))
					}
				}
			}
		})
		.catch(reason => reject(reason))
}
const _promise = (plans) => new Promise((resolve, reject) => {
	const tasks = new Map()
	const dependents = new Map()
	for (const [dependencies, getPromise] of plans) {
		const clone = [...dependencies]
		tasks.set(clone, getPromise)
		for (const p of clone) {
			if (_isFunction(p)) {
				if (dependents.has(p)) {
					dependents.get(p).push(clone)
				} else {
					dependents.set(p, [ clone ])
				}
			}
		}
	}
	const count = [ tasks.size ]
	for (const [dependencies, getPromise] of tasks) {
		if (dependencies.every(p => !_isFunction(p))) {
			_next(resolve, reject, tasks, dependents, count, dependencies, getPromise)
				.catch(reason => reject(reason))
		}
	}
})
const dag = () => {
	const plans = new Map()
	const promise = () => _promise(plans)
	const add = (getPromise, ...dependencies) => {
		plans.set(dependencies.map(v => v.promise || v), getPromise.promise || getPromise)
		return utils
	}
	const utils = { promise, add }
	return utils
}

const _encode = (array, value, prefix) => {
	if (value && typeof value === "object") {
		if (value instanceof Array) {
			for (let k in value) {
				_encode(array, value[k], prefix + "%5B" + encodeURIComponent(k) + "%5D")
			}
		} else {
			for (let k in value) {
				_encode(array, value[k], prefix + "." + encodeURIComponent(k))
			}
		}
	} else {
		array.push(prefix + "=" + encodeURIComponent(value))
	}
}
const _toQuery = (args) => {
	if (!args) {
		return ""
	}
	const array = [];
	for (let k in args) {
		_encode(array, args[k], encodeURIComponent(k))
	}
	return "?" + array.join("&");
}
const request = (input) => {
	let _mode/* string */
	let _cache/* string */
	let _credentials/* string */
	let _headers = { "Content-Type": "application/json; charset=UTF-8" }
	let _redirect/* string */
	let _referrerPolicy/* string */
	let _timeout/* number */

	const mode = (value) => {
		_mode = value
		return utils
	}
	const cache = (value) => {
		_cache = value
		return utils
	}
	const credentials = (value) => {
		_credentials = value
		return utils
	}
	const headers = (headers) => {
		_headers = { ..._headers, ...headers }
		return utils
	}
	const redirect = (value) => {
		_redirect = value
		return utils
	}
	const referrerPolicy = (value) => {
		_referrerPolicy = value
		return utils
	}
	const timeout = (ms) => {
		_timeout = ms
		return utils
	}
	const get = args => fetch(input + _toQuery(args), init())
	const method = (method, args) => fetch(input, init(method, args))
	const init = (method, body) => {
		if (body && !(body instanceof FormData)) {
			body = JSON.stringify(body)
		}
		let signal
		if (_timeout) {
			const controller = new AbortController()
			setTimeout(() => controller.abort(), _timeout)
			signal = controller.signal
		}
		return {
			method,
			mode: _mode,
			cache: _cache,
			credentials: _credentials,
			headers: _headers,
			redirect: _redirect,
			referrerPolicy: _referrerPolicy,
			signal,
			body
		}
	}

	const utils = {
		mode,
		cache,
		credentials,
		headers,
		redirect,
		referrerPolicy,
		timeout,
		get,
		method
	}
	return utils
}

export { builder, dag, request }