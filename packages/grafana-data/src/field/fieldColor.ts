import { interpolateRgbBasis } from 'd3-interpolate';

import { GrafanaTheme2 } from '../themes/types';
import { reduceField } from '../transformations/fieldReducer';
import { FALLBACK_COLOR, Field, FieldColorModeId, Threshold } from '../types';
import { RegistryItem } from '../utils';
import { Registry } from '../utils/Registry';

import { getScaleCalculator, ColorScaleValue } from './scale';
import { fallBackTreshold } from './thresholds';

/** @beta */
export type FieldValueColorCalculator = (value: number, percent: number, Threshold?: Threshold) => string;

/** @beta */
export interface FieldColorMode extends RegistryItem {
  getCalculator: (field: Field, theme: GrafanaTheme2) => FieldValueColorCalculator;
  getColors?: (theme: GrafanaTheme2) => string[];
  isContinuous?: boolean;
  isByValue?: boolean;
}

/** @internal */
export const fieldColorModeRegistry = new Registry<FieldColorMode>(() => {
  return [
    {
      id: FieldColorModeId.Fixed,
      name: 'Single color',
      description: 'Set a specific color',
      getCalculator: getFixedColor,
    },
    {
      id: FieldColorModeId.Thresholds,
      name: 'From thresholds',
      isByValue: true,
      description: 'Derive colors from thresholds',
      getCalculator: (_field, theme) => {
        return (_value, _percent, threshold) => {
          const thresholdSafe = threshold ?? fallBackTreshold;
          return theme.visualization.getColorByName(thresholdSafe.color);
        };
      },
    },
    new FieldColorSchemeMode({
      id: FieldColorModeId.PaletteClassic,
      name: 'Classic palette',
      isContinuous: false,
      isByValue: false,
      getColors: (theme: GrafanaTheme2) => {
        return theme.visualization.palette;
      },
    }),
    new FieldColorSchemeModeName({
      id: FieldColorModeId.PaletteClassicNetworkGuysInOut,
      name: 'Classic palette (Network Guys in-out)',
      isContinuous: false,
      isByValue: false,
      getColors: (theme: GrafanaTheme2) => {
        return theme.visualization.palette;
      },
    }),
    new FieldColorSchemeMode({
      id: 'continuous-GrYlRd',
      name: 'Green-Yellow-Red',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['green', 'yellow', 'red'],
    }),
    new FieldColorSchemeMode({
      id: 'continuous-RdYlGr',
      name: 'Red-Yellow-Green',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['red', 'yellow', 'green'],
    }),
    new FieldColorSchemeMode({
      id: 'continuous-BlYlRd',
      name: 'Blue-Yellow-Red',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['dark-blue', 'super-light-yellow', 'dark-red'],
    }),
    new FieldColorSchemeMode({
      id: 'continuous-YlRd',
      name: 'Yellow-Red',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['super-light-yellow', 'dark-red'],
    }),
    new FieldColorSchemeMode({
      id: 'continuous-BlPu',
      name: 'Blue-Purple',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['blue', 'purple'],
    }),
    new FieldColorSchemeMode({
      id: 'continuous-YlBl',
      name: 'Yellow-Blue',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['super-light-yellow', 'dark-blue'],
    }),
    new FieldColorSchemeMode({
      id: 'continuous-blues',
      name: 'Blues',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['panel-bg', 'dark-blue'],
    }),
    new FieldColorSchemeMode({
      id: 'continuous-reds',
      name: 'Reds',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['panel-bg', 'dark-red'],
    }),
    new FieldColorSchemeMode({
      id: 'continuous-greens',
      name: 'Greens',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['panel-bg', 'dark-green'],
    }),
    new FieldColorSchemeMode({
      id: 'continuous-purples',
      name: 'Purples',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['panel-bg', 'dark-purple'],
    }),
  ];
});

interface FieldColorSchemeModeOptions {
  id: string;
  name: string;
  description?: string;
  getColors: (theme: GrafanaTheme2) => string[];
  isContinuous: boolean;
  isByValue: boolean;
}

export class FieldColorSchemeMode implements FieldColorMode {
  id: string;
  name: string;
  description?: string;
  isContinuous: boolean;
  isByValue: boolean;
  colorCache?: string[];
  colorCacheTheme?: GrafanaTheme2;
  interpolator?: (value: number) => string;
  getNamedColors?: (theme: GrafanaTheme2) => string[];

  constructor(options: FieldColorSchemeModeOptions) {
    this.id = options.id;
    this.name = options.name;
    this.description = options.description;
    this.getNamedColors = options.getColors;
    this.isContinuous = options.isContinuous;
    this.isByValue = options.isByValue;
  }

  getColors(theme: GrafanaTheme2): string[] {
    if (!this.getNamedColors) {
      return [];
    }

    if (this.colorCache && this.colorCacheTheme === theme) {
      return this.colorCache;
    }

    this.colorCache = this.getNamedColors(theme).map(theme.visualization.getColorByName);
    this.colorCacheTheme = theme;

    return this.colorCache;
  }

  private getInterpolator() {
    if (!this.interpolator) {
      this.interpolator = interpolateRgbBasis(this.colorCache!);
    }

    return this.interpolator;
  }

  getCalculator(field: Field, theme: GrafanaTheme2) {
    const colors = this.getColors(theme);

    if (this.isByValue) {
      if (this.isContinuous) {
        return (_: number, percent: number, _threshold?: Threshold) => {
          return this.getInterpolator()(percent);
        };
      } else {
        return (_: number, percent: number, _threshold?: Threshold) => {
          return colors[percent * (colors.length - 1)];
        };
      }
    } else {
      return (_: number, _percent: number, _threshold?: Threshold) => {
        const seriesIndex = field.state?.seriesIndex ?? 0;
        return colors[seriesIndex % colors.length];
      };
    }
  }
}

export class FieldColorSchemeModeName extends FieldColorSchemeMode {
  colorIndex: 0;
  colorMap: Record<string, string>;

  constructor(options: FieldColorSchemeModeOptions) {
    super(options);

    this.colorIndex = 0;
    this.colorMap = {};
  }

  getCalculator(field: Field, theme: GrafanaTheme2): (_: number, percent: number, _threshold?: Threshold) => string {
    const colors = this.getColors(theme);

    const baseNameRegex = /(.+) (in|out)/;

    return (_: number, _percent: number, _threshold?: Threshold) => {
      let name = field.state?.displayName ?? null;
      if (name === null) {
        return colors[this.colorIndex++ % colors.length];
      }

      const baseNameMatch = baseNameRegex.exec(name);

      if (baseNameMatch === null) {
        return colors[this.colorIndex++ % colors.length];
      }

      const baseName = baseNameMatch[1];

      if (this.colorMap[baseName] === undefined) {
        const color = colors[this.colorIndex++ % colors.length];
        this.colorMap[baseName] = color;

        return color;
      } else {
        return this.colorMap[baseName];
      }
    };
  }
}

/** @beta */
export function getFieldColorModeForField(field: Field): FieldColorMode {
  return fieldColorModeRegistry.get(field.config.color?.mode ?? FieldColorModeId.Thresholds);
}

/** @beta */
export function getFieldColorMode(mode?: FieldColorModeId | string): FieldColorMode {
  return fieldColorModeRegistry.get(mode ?? FieldColorModeId.Thresholds);
}

/**
 * @alpha
 * Function that will return a series color for any given color mode. If the color mode is a by value color
 * mode it will use the field.config.color.seriesBy property to figure out which value to use
 */
export function getFieldSeriesColor(field: Field, theme: GrafanaTheme2): ColorScaleValue {
  const mode = getFieldColorModeForField(field);

  if (!mode.isByValue) {
    return {
      color: mode.getCalculator(field, theme)(0, 0),
      threshold: fallBackTreshold,
      percent: 1,
    };
  }

  const scale = getScaleCalculator(field, theme);
  const stat = field.config.color?.seriesBy ?? 'last';
  const calcs = reduceField({ field, reducers: [stat] });
  const value = calcs[stat] ?? 0;

  return scale(value);
}

function getFixedColor(field: Field, theme: GrafanaTheme2) {
  return () => {
    return theme.visualization.getColorByName(field.config.color?.fixedColor ?? FALLBACK_COLOR);
  };
}
