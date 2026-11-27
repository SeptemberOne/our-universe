import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface SupabaseAuthStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

function isServerRender(): boolean {
  return Platform.OS === 'web' && typeof window === 'undefined';
}

export const supabaseStorage: SupabaseAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    if (isServerRender()) {
      return null;
    }
    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isServerRender()) {
      return;
    }
    await AsyncStorage.setItem(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (isServerRender()) {
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};
