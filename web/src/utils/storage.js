const AUTH_KEYS = ['token', 'refreshToken', 'sessionId', 'user'];

export const AUTH_PERSIST_KEY = 'authPersist';
export const REMEMBER_EMAIL_KEY = 'rememberedLoginEmail';

const getStorageByPersist = (persist) => (persist ? localStorage : sessionStorage);

export const getAuthPersist = () => localStorage.getItem(AUTH_PERSIST_KEY) !== 'false';

export const setAuthPersist = (persist) => {
	localStorage.setItem(AUTH_PERSIST_KEY, persist ? 'true' : 'false');
};

export const getAuthValue = (key) => localStorage.getItem(key) ?? sessionStorage.getItem(key);

export const setAuthValues = (values, persist) => {
	const targetStorage = getStorageByPersist(persist);
	const otherStorage = persist ? sessionStorage : localStorage;

	AUTH_KEYS.forEach((key) => {
		if (values[key] === undefined || values[key] === null || values[key] === '') {
			targetStorage.removeItem(key);
		} else {
			targetStorage.setItem(key, String(values[key]));
		}
		otherStorage.removeItem(key);
	});

	setAuthPersist(persist);
};

export const clearAuthValues = () => {
	AUTH_KEYS.forEach((key) => {
		localStorage.removeItem(key);
		sessionStorage.removeItem(key);
	});
};

export const getRememberedEmail = () => localStorage.getItem(REMEMBER_EMAIL_KEY) || '';

export const setRememberedEmail = (email) => {
	if (!email) {
		localStorage.removeItem(REMEMBER_EMAIL_KEY);
		return;
	}
	localStorage.setItem(REMEMBER_EMAIL_KEY, email);
};
