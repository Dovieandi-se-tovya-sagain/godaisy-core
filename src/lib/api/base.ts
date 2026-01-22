import axios from 'axios';

export const weatherApi = axios.create({
  baseURL: 'https://api.openweathermap.org/data/2.5',
  timeout: 10000,
});

// Automatically add your API key to all requests
weatherApi.interceptors.request.use((config) => {
  config.params = {
    ...config.params,
    appid: process.env.NEXT_PUBLIC_OPENWEATHER_KEY,
  };
  return config;
});

