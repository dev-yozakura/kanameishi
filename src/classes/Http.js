import axios from "axios";
import { fetch } from '@tauri-apps/plugin-http';

class Http {
    static async get(url, config = { timeout: 30000 }) {
        try {
            const res = await axios.get(url, config)
            return res.data
        }
        catch (err){
            console.log(err);
        }
    }
    static async post(url, data, config = { timeout: 30000 }) {
        try {
            const res = await axios.post(url, data, config)
            return res.data
        }
        catch (err){
            console.log(err);
        }
    }
    static async tauriGet(url, config = {
        connectTimeout: 30000
    }) {
        try {
            const res = await fetch(url, {
                method: 'GET',
                ...config
            })
            const data = await res.json()
            return data
        } catch (e) {
            console.log(e);
        }
    }

    static async tauriPost(url, data, config = {
        connectTimeout: 30000,
        headers: {}
    }) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(config.headers || {})
                },
                body: JSON.stringify(data ?? {}),
                ...config
            })
            const json = await res.json()
            return json
        } catch (e) {
            console.log(e);
        }
    }
}

export default Http;