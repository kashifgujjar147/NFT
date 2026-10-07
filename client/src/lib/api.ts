import axios from 'axios';
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL??'/api',withCredentials:true});
let accessToken:string|null=localStorage.getItem('accessToken');
export const getAccessToken=()=>accessToken;
export const setAccessToken=(token:string|null)=>{accessToken=token;if(token)localStorage.setItem('accessToken',token);else localStorage.removeItem('accessToken');};
let refreshing:Promise<string|null>|null=null;
api.interceptors.request.use(config=>{if(accessToken)config.headers.Authorization=`Bearer ${accessToken}`;return config;});
api.interceptors.response.use(r=>r,async error=>{const original=error.config;if(localStorage.getItem('impersonationSession'))return Promise.reject(error);if(error.response?.status!==401||original?.url?.includes('/auth/refresh')||original?._retry)return Promise.reject(error);original._retry=true;refreshing??=(async()=>{try{const r=await api.post('/auth/refresh');setAccessToken(r.data.data.accessToken);localStorage.setItem('member',JSON.stringify(r.data.data.user));return r.data.data.accessToken;}catch{setAccessToken(null);localStorage.removeItem('member');return null;}finally{refreshing=null;}})();const token=await refreshing;if(!token)return Promise.reject(error);original.headers.Authorization=`Bearer ${token}`;return api(original);});



