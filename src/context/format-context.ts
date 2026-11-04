import { createContext } from 'react';
import type { Settings } from '../domain/models';
export const FormatSettingsContext = createContext<Settings | null>(null);
