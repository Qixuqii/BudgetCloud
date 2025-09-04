const storage = {
    get(key, defalultValue = null){
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : defalultValue;
        }catch {
            return defalultValue;
        }
    },

    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    remove(key) {
        localStorage.removeItem(key);
    }
}

export default storage;