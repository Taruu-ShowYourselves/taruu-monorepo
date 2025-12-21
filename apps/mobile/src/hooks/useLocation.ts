import { useState, useCallback } from 'react';
import * as Location from 'expo-location';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);

  const requestPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);
    return status === 'granted';
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    setLoading(true);
    setError(null);

    try {
      // Check permission first
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          setError('הרשאת מיקום נדחתה');
          return null;
        }
      }

      // Get current position
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationData: LocationData = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: result.coords.accuracy,
      };

      setLocation(locationData);
      return locationData;
    } catch (err: any) {
      const message = err.message || 'שגיאה בקבלת המיקום';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [requestPermission]);

  const isInMunicipality = useCallback(
    async (municipalityBounds: {
      north: number;
      south: number;
      east: number;
      west: number;
    }): Promise<boolean> => {
      const loc = location || (await getCurrentLocation());
      if (!loc) return false;

      return (
        loc.latitude <= municipalityBounds.north &&
        loc.latitude >= municipalityBounds.south &&
        loc.longitude <= municipalityBounds.east &&
        loc.longitude >= municipalityBounds.west
      );
    },
    [location, getCurrentLocation]
  );

  return {
    location,
    loading,
    error,
    permissionStatus,
    requestPermission,
    getCurrentLocation,
    isInMunicipality,
  };
}
