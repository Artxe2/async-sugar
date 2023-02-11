const builder = getPromise => {
	getPromise = getPromise.promise || getPromise

	let currentPromise/* Promise */
	let inProgress/* Promise */

	let allow429Error
	let allow409Error
	let allow102Error
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
	let throttlePromise /* Promise */
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

const dag = () => {
	const plans = new Map()
	const isFunction = p => typeof p === "function"
	const next = async (resolve, reject, tasks, dependents, count, dependencies, getPromise) => {
		const promise = dependencies.length
			? getPromise(...(await Promise.all(dependencies)))
			: getPromise()
		promise
			.then(value => {
				tasks.set(dependencies, value)
				if (++count[0] === tasks.size) {
					resolve(Promise.all([...tasks.values()]))
				}
				const queue = dependents.get(getPromise)
				if (queue) {
					for (const p of queue) {
						p[p.indexOf(getPromise)] = value
						if (p.every(p => !isFunction(p))) {
							next(resolve, reject, tasks, dependents, count, p, tasks.get(p))
								.catch(reason => reject(reason))
						}
					}
				}
			})
			.catch(reason => reject(reason))
	}
	const promise = () => new Promise((resolve, reject) => {
		const tasks = new Map()
		const dependents = new Map()
		for (const [dependencies, getPromise] of plans) {
			const clone = [...dependencies]
			tasks.set(clone, getPromise)
			for (const p of clone) {
				if (isFunction(p)) {
					if (dependents.has(p)) {
						dependents.get(p).push(clone)
					} else {
						dependents.set(p, [ clone ])
					}
				}
			}
		}
		const count = [ 0 ]
		for (const [dependencies, getPromise] of tasks) {
			if (dependencies.every(p => !isFunction(p))) {
				next(resolve, reject, tasks, dependents, count, dependencies, getPromise)
					.catch(reason => reject(reason))
			}
		}
	})
	const add = (getPromise, ...dependencies) => {
		plans.set(dependencies.map(v => v.promise || v), getPromise.promise || getPromise)
		return utils
	}
	const utils = { promise, add }
	return utils
}

export { builder, dag }