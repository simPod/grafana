import { interpolateRgbBasis } from 'd3-interpolate';
import stringHash from 'string-hash';
import tinycolor from 'tinycolor2';

import {getContrastRatio, lighten} from '../themes/colorManipulator';
import { GrafanaTheme2 } from '../themes/types';
import { reduceField } from '../transformations/fieldReducer';
import { Field } from '../types/dataFrame';
import { FALLBACK_COLOR, FieldColorModeId } from '../types/fieldColor';
import { Threshold } from '../types/thresholds';
import { Registry, RegistryItem } from '../utils/Registry';

import { getScaleCalculator, ColorScaleValue } from './scale';
import { fallBackThreshold } from './thresholds';

const flopNameRegex = /(.+?)(?: → (.+?))? (in|out)/;

const colors = [
  '#7EB26D', // 0: pale green
  '#EAB839', // 1: mustard
  '#6ED0E0', // 2: light blue
  '#EF843C', // 3: orange
  '#E24D42', // 4: red
  '#1F78C1', // 5: ocean
  '#BA43A9', // 6: purple
  '#705DA0', // 7: violet
  '#508642', // 8: dark green
  '#CCA300', // 9: dark sand
  '#447EBC',
  '#C15C17',
  '#890F02',
  '#0A437C',
  '#6D1F62',
  '#584477',
  '#B7DBAB',
  '#F4D598',
  '#70DBED',
  '#F9BA8F',
  '#F29191',
  '#82B5D8',
  '#E5A8E2',
  '#AEA2E0',
  '#629E51',
  '#E5AC0E',
  '#64B0C8',
  '#E0752D',
  '#BF1B00',
  '#0A50A1',
  '#962D82',
  '#614D93',
  '#9AC48A',
  '#F2C96D',
  '#65C5DB',
  '#F9934E',
  '#EA6460',
  '#5195CE',
  '#D683CE',
  '#806EB7',
  '#3F6833',
  '#967302',
  '#2F575E',
  '#99440A',
  '#58140C',
  '#052B51',
  '#511749',
  '#3F2B5B',
  '#E0F9D7',
  '#FCEACA',
  '#CFFAFF',
  '#F9E2D2',
  '#FCE2DE',
  '#BADFF4',
  '#F9D9F9',
  '#DEDAF7',
];

/** @beta */
export type FieldValueColorCalculator = (value: number, percent: number, Threshold?: Threshold) => string;

/** @beta */
export interface FieldColorMode extends RegistryItem {
  getCalculator: (field: Field, theme: GrafanaTheme2) => FieldValueColorCalculator;
  getColors?: (theme: GrafanaTheme2) => string[];
  isContinuous?: boolean;
  isByValue?: boolean;
  useSeriesName?: boolean;
}

/** @internal */
export const fieldColorModeRegistry = new Registry<FieldColorMode>(() => {
  return [
    {
      id: FieldColorModeId.Fixed,
      name: 'Single color',
      description: 'Set a specific color',
      getCalculator: getFixedColor(new FixedColorState()),
    },
    {
      id: FieldColorModeId.Shades,
      name: 'Shades of a color',
      description: 'Select shades of a specific color',
      getCalculator: getShadedColor,
    },
    {
      id: FieldColorModeId.Thresholds,
      name: 'From thresholds',
      isByValue: true,
      description: 'Derive colors from thresholds',
      getCalculator: (_field, theme) => {
        return (_value, _percent, threshold) => {
          const thresholdSafe = threshold ?? fallBackThreshold;
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
      getColors: () => colors,
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.PaletteClassicByName,
      name: 'Classic palette (by series name)',
      isContinuous: false,
      isByValue: false,
      useSeriesName: true,
      getColors: (theme: GrafanaTheme2) => {
        return theme.visualization.palette.filter(
          (color) =>
            getContrastRatio(theme.visualization.getColorByName(color), theme.colors.background.primary) >=
            theme.colors.contrastThreshold
        );
      },
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousGrYlRd,
      name: 'Green-Yellow-Red',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['green', 'yellow', 'red'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousRdYlGr,
      name: 'Red-Yellow-Green',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['red', 'yellow', 'green'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousBlYlRd,
      name: 'Blue-Yellow-Red',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['dark-blue', 'super-light-yellow', 'dark-red'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousYlRd,
      name: 'Yellow-Red',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['super-light-yellow', 'dark-red'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousBlPu,
      name: 'Blue-Purple',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['blue', 'purple'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousYlBl,
      name: 'Yellow-Blue',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['super-light-yellow', 'dark-blue'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousBlues,
      name: 'Blues',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['panel-bg', 'dark-blue'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousReds,
      name: 'Reds',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['panel-bg', 'dark-red'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousGreens,
      name: 'Greens',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['panel-bg', 'dark-green'],
    }),
    new FieldColorSchemeMode({
      id: FieldColorModeId.ContinuousPurples,
      name: 'Purples',
      isContinuous: true,
      isByValue: true,
      getColors: (theme: GrafanaTheme2) => ['panel-bg', 'dark-purple'],
    }),
  ];
});

interface FieldColorSchemeModeOptions {
  id: FieldColorModeId;
  name: string;
  description?: string;
  getColors: (theme: GrafanaTheme2) => string[];
  isContinuous: boolean;
  isByValue: boolean;
  useSeriesName?: boolean;
}

export class FieldColorSchemeMode implements FieldColorMode {
  id: FieldColorModeId;
  name: string;
  description?: string;
  isContinuous: boolean;
  isByValue: boolean;
  useSeriesName?: boolean;
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
    this.useSeriesName = options.useSeriesName;
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
    } else if (this.useSeriesName) {
      return (_: number, _percent: number, _threshold?: Threshold) => {
        return colors[Math.abs(stringHash(field.state?.displayName ?? field.name)) % colors.length];
      };
    } else {
      return (_: number, _percent: number, _threshold?: Threshold) => {
        const seriesIndex = field.state?.seriesIndex ?? 0;
        return colors[seriesIndex % colors.length];
      };
    }
  }
}

export class FieldColorSchemeModeName extends FieldColorSchemeMode {
  baseColorMap: Record<string, string>;
  colorMap: Record<string, string>;
  baseSeriesIndex: number;
  colors: string[]|undefined;
  subSeriesIndex: Record<string, number>;

  constructor(options: FieldColorSchemeModeOptions) {
    super(options);

    this.baseColorMap = {};
    this.colorMap = {};
    this.baseSeriesIndex = 0;
    this.subSeriesIndex = {};
  }

  getCalculator(field: Field, theme: GrafanaTheme2): (_: number, percent: number, _threshold?: Threshold) => string {
    const colorsPalette = this.getColors(theme);

    return (_: number, _percent: number, _threshold?: Threshold) => {
      const name = field.state?.displayName ?? field.labels?.name ?? null;
      if (name === null) {
        return colorsPalette[(this.baseSeriesIndex++) % colorsPalette.length];
      }

      const nameMatch = flopNameRegex.exec(name);

      if (nameMatch === null) {
        return colorsPalette[(this.baseSeriesIndex++) % colorsPalette.length];
      }

      const baseName = nameMatch[1];
      const subName = nameMatch[2];
      const nameKey = subName ? `${baseName} → ${subName}` : baseName;

      let color = this.colorMap[nameKey];
      if (color === undefined) {
        let baseColor = this.baseColorMap[baseName];
        if(baseColor === undefined) {
          baseColor = colorsPalette[(this.baseSeriesIndex++) % colorsPalette.length]
          this.baseColorMap[baseName] = baseColor;
        }

        if (subName === undefined) {
          color = baseColor;
        } else {
          if (this.subSeriesIndex[baseName] === undefined) {
            this.subSeriesIndex[baseName] = 0
          }
          this.subSeriesIndex[baseName] += 1;
          color = lighten(baseColor, 0.05 * (this.subSeriesIndex[baseName]));
        }

        this.colorMap[nameKey] = color;
      }

      return color;
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
      threshold: fallBackThreshold,
      percent: 1,
    };
  }

  const scale = getScaleCalculator(field, theme);
  const stat = field.config.color?.seriesBy ?? 'last';
  const calcs = reduceField({ field, reducers: [stat] });
  const value = calcs[stat] ?? 0;

  return scale(value);
}

class FixedColorState {
  colorMap: Record<string, string>;
  subSeriesIndex: Record<string, number>;

  constructor() {
    this.colorMap = {};
    this.subSeriesIndex = {};
  }
}

const getFixedColor = (state: FixedColorState) => (field: Field, theme: GrafanaTheme2)=> {
  return () => {
    const name = field.state?.displayName ?? field.labels?.name ?? null;

    let baseColor = theme.visualization.getColorByName(field.config.color?.fixedColor ?? FALLBACK_COLOR);
    if (name === null) {
      return baseColor;
    }

    const nameMatch = flopNameRegex.exec(name);

    if (nameMatch === null) {
      return baseColor;
    }

    const baseName = nameMatch[1];
    const subName = nameMatch[2];
    const nameKey = subName ? `${baseName} → ${subName}` : baseName;

    let color = state.colorMap[nameKey];
    if (color === undefined) {
      if (subName === undefined) {
        return baseColor;
      }

      if (state.subSeriesIndex[baseName] === undefined) {
        state.subSeriesIndex[baseName] = 0
      }

      state.subSeriesIndex[baseName] += 1;
      color = lighten(baseColor, 0.05 * (state.subSeriesIndex[baseName]));
      console.log(color);
      state.colorMap[nameKey] = color;
    }

    return color;
  };
};

function getShadedColor(field: Field, theme: GrafanaTheme2) {
  return () => {
    const baseColorString: string = theme.visualization.getColorByName(
      field.config.color?.fixedColor ?? FALLBACK_COLOR
    );

    const colors: string[] = [
      baseColorString, // start with base color
    ];

    const shadesCount = 6;
    const maxHueSpin = 10; // hue spin, max is 360
    const maxDarken = 35; // max 100%
    const maxBrighten = 35; // max 100%

    for (let i = 1; i < shadesCount; i++) {
      // push alternating darker and brighter shades
      colors.push(
        tinycolor(baseColorString)
          .spin((i / shadesCount) * maxHueSpin)
          .brighten((i / shadesCount) * maxDarken)
          .toHexString()
      );
      colors.push(
        tinycolor(baseColorString)
          .spin(-(i / shadesCount) * maxHueSpin)
          .darken((i / shadesCount) * maxBrighten)
          .toHexString()
      );
    }

    const seriesIndex = field.state?.seriesIndex ?? 0;
    return colors[seriesIndex % colors.length];
  };
}
