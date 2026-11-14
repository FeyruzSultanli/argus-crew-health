// Short labels and environment icons for the six mission profiles (mission chip + profile picker).
import { CarFront, Mountain, Moon, Navigation, Rocket, Satellite } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { MissionProfileId } from '../../domain/types';

export const PROFILE_META: Record<
  MissionProfileId,
  { short: string; icon: LucideIcon; environment: string }
> = {
  iss: { short: 'ISS', icon: Satellite, environment: 'Low Earth orbit, microgravity' },
  'lunar-transit': { short: 'Lunar transit', icon: Rocket, environment: 'Deep space, microgravity' },
  'lunar-surface': { short: 'Lunar base', icon: Moon, environment: 'Lunar surface, partial gravity' },
  'lunar-rover': { short: 'Lunar rover', icon: CarFront, environment: 'Pressurized rover, partial gravity' },
  'mars-transit': { short: 'Mars transit', icon: Navigation, environment: 'Deep space, microgravity' },
  'mars-surface': { short: 'Mars base', icon: Mountain, environment: 'Mars surface, partial gravity' },
};
