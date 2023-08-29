import {
  isEmptyObject,
  VariableWithOptions
} from '@grafana/data';
import {DashboardModel} from 'app/features/dashboard/state';

import {getCurrentText, getCurrentValue, isAllVariable} from "../../features/variables/utils";

const valueFromVariableWitOptions = (variable: VariableWithOptions): string|string[] | null => {
  if (isEmptyObject(variable) || !variable.current || variable.current.value === undefined || variable.current.value === null) {
    return null;
  }

  if (isAllVariable(variable.current.value)) {
    return variable.current.value;
  }

  if (Array.isArray(variable.current.value)) {
    return variable.current.value;
  }

  if (typeof variable.current.value !== 'string') {
    return null;
  }

  return variable.current.value;
};

export const triggerAsnQuality = (dashboard: DashboardModel, panelId: number) => {
  const panel = dashboard.getPanelById(panelId)!;

  const currentVariables = {
    ...dashboard.getVariables().reduce<Record<string, {text: string, value: string | string[] | undefined}>>(
      (acc, variable) => {
        if (variable.type === 'adhoc' || variable.type === 'system') {
          return acc;
        }

        let value: string|string[]|null = null;
        if (variable.type === 'custom' || variable.type === 'query') {
          value = valueFromVariableWitOptions(variable);
        } else if (
          variable.type === 'constant'
          || variable.type === 'datasource' || variable.type === 'interval' || variable.type === 'textbox'
        ) {
          value = getCurrentValue(variable);
        }

        if (value === null) {
          return acc;
        }

        return {...acc, [variable.name]: {text: getCurrentText(variable), value}};
      },
      {}
    ),
    ...Object.entries(panel.scopedVars ?? {}).reduce(
      (acc, [key, value]) => {
        if (value === undefined) {
          return acc;
        }
        return {...acc, [key]: {text: value.text, value: value.value}};
      },
      {}
    ),
  };

  parent.postMessage({
    currentVariables: currentVariables,
    type: "flop.asn.quality",
    variables:dashboard.getVariables(),
  });
}
