
import { WeatherData } from "../types";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Moon, Sun, Snowflake } from "lucide-react";
import React from 'react';

// Mapeamento de códigos WMO para Ícones e Descrições (PT-BR)
export const getWeatherInfo = (code: number, isNight: boolean = false) => {
  // Códigos WMO: https://open-meteo.com/en/docs
  switch (code) {
    case 0: 
      return { icon: isNight ? Moon : Sun, label: 'Céu Limpo', color: 'text-amber-400' };
    case 1: 
    case 2: 
    case 3: 
      return { icon: CloudSun, label: 'Parcialmente Nublado', color: 'text-blue-300' };
    case 45: 
    case 48: 
      return { icon: CloudFog, label: 'Nevoeiro', color: 'text-slate-400' };
    case 51: case 53: case 55: 
    case 56: case 57:
      return { icon: CloudDrizzle, label: 'Garoa', color: 'text-blue-400' };
    case 61: case 63: case 65:
    case 66: case 67:
    case 80: case 81: case 82:
      return { icon: CloudRain, label: 'Chuva', color: 'text-blue-500' };
    case 71: case 73: case 75: case 77:
    case 85: case 86:
      return { icon: CloudSnow, label: 'Neve', color: 'text-white' };
    case 95: case 96: case 99:
      return { icon: CloudLightning, label: 'Tempestade', color: 'text-purple-400' };
    default: 
      return { icon: Cloud, label: 'Nublado', color: 'text-slate-400' };
  }
};

export const fetchWeather = async (lat: number, lon: number): Promise<WeatherData | null> => {
  try {
    // Open-Meteo API (Gratuito, sem API Key, CORS enabled)
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
    );

    if (!response.ok) throw new Error("Weather API Error");

    const data = await response.json();

    return {
      current: {
        temp: Math.round(data.current.temperature_2m),
        code: data.current.weather_code
      },
      today: {
        min: Math.round(data.daily.temperature_2m_min[0]),
        max: Math.round(data.daily.temperature_2m_max[0]),
        code: data.daily.weather_code[0]
      },
      tomorrow: {
        min: Math.round(data.daily.temperature_2m_min[1]),
        max: Math.round(data.daily.temperature_2m_max[1]),
        code: data.daily.weather_code[1]
      }
    };
  } catch (error) {
    console.error("Erro ao buscar clima:", error);
    return null;
  }
};

// Tenta obter o nome da cidade via Reverse Geocoding (OpenStreetMap/Nominatim - Free)
export const fetchLocationName = async (lat: number, lon: number): Promise<string> => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
        const data = await response.json();
        return data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || "Localização Atual";
    } catch (e) {
        return "Localização Atual";
    }
};
