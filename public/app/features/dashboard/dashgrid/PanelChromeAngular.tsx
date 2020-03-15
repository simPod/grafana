import classNames from 'classnames';
import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { Subscription } from 'rxjs';

import { getDefaultTimeRange, LoadingState, PanelData, PanelPlugin } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { AngularComponent, getAngularLoader, locationService } from '@grafana/runtime';
import config from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { setPanelAngularComponent } from 'app/features/panel/state/reducers';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { StoreState } from 'app/types';

import { isSoloRoute } from '../../../routes/utils';
import { getTimeSrv, TimeSrv } from '../services/TimeSrv';
import { DashboardModel, PanelModel } from '../state';

import { LazyLoader } from './LazyLoader';
import { PanelHeader } from './PanelHeader/PanelHeader';

interface OwnProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  plugin: PanelPlugin;
  isViewing: boolean;
  isEditing: boolean;
  isInView: boolean;
  onVisibilityChange: (v: boolean) => void;
  width: number;
  height: number;
}

interface ConnectedProps {
  angularComponent?: AngularComponent;
}

interface DispatchProps {
  setPanelAngularComponent: typeof setPanelAngularComponent;
}

export type Props = OwnProps & ConnectedProps & DispatchProps;

export interface State {
  isInView: boolean;
  loaded: boolean;
  data: PanelData;
  errorMessage?: string;
}

interface AngularScopeProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  size: {
    height: number;
    width: number;
  };
}

export class PanelChromeAngularUnconnected extends PureComponent<Props, State> {
  element: HTMLElement | null = null;
  timeSrv: TimeSrv = getTimeSrv();
  scopeProps?: AngularScopeProps;
  subs = new Subscription();

  constructor(props: Props) {
    super(props);
    this.state = {
      data: {
        state: LoadingState.NotStarted,
        series: [],
        timeRange: getDefaultTimeRange(),
      },
      isInView: props.isInView,
      loaded: false,
    };
  }

  componentDidMount() {
    const { panel } = this.props;
    this.loadAngularPanel();

    // subscribe to data events
    const queryRunner = panel.getQueryRunner();

    // we are not displaying any of this data so no need for transforms or field config
    this.subs.add(
      queryRunner.getData({ withTransforms: false, withFieldConfig: false }).subscribe({
        next: (data: PanelData) => this.onPanelDataUpdate(data),
      })
    );
  }

  onPanelDataUpdate(data: PanelData) {
    let errorMessage: string | undefined;

    if (data.state === LoadingState.Error) {
      const { error } = data;
      if (error) {
        if (errorMessage !== error.message) {
          errorMessage = error.message;
        }
      }
    }

    this.setState({ data, errorMessage });
  }

  componentWillUnmount() {
    this.subs.unsubscribe();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const { plugin, height, width, panel } = this.props;
    const { isInView, loaded } = this.state;

    if (prevProps.plugin !== plugin || (prevState.isInView !== isInView && !loaded)) {
      this.loadAngularPanel();
    }

    if (prevProps.width !== width || prevProps.height !== height) {
      if (this.scopeProps) {
        this.scopeProps.size.height = this.getInnerPanelHeight();
        this.scopeProps.size.width = this.getInnerPanelWidth();
        panel.render();
      }
    }
  }

  getInnerPanelHeight() {
    const { plugin, height } = this.props;
    const { theme } = config;

    const headerHeight = this.hasOverlayHeader() ? 0 : theme.panelHeaderHeight;
    const chromePadding = plugin.noPadding ? 0 : theme.panelPadding;
    return height - headerHeight - chromePadding * 2 - PANEL_BORDER;
  }

  getInnerPanelWidth() {
    const { plugin, width } = this.props;
    const { theme } = config;

    const chromePadding = plugin.noPadding ? 0 : theme.panelPadding;
    return width - chromePadding * 2 - PANEL_BORDER;
  }

  loadAngularPanel() {
    const { panel, dashboard, setPanelAngularComponent } = this.props;

    // if we have no element or already have loaded the panel return
    if (!this.element) {
      return;
    }

    const loader = getAngularLoader();
    const template = '<plugin-component type="panel" class="panel-height-helper"></plugin-component>';

    this.scopeProps = {
      panel: panel,
      dashboard: dashboard,
      size: { width: this.getInnerPanelWidth(), height: this.getInnerPanelHeight() },
    };

    setPanelAngularComponent({
      key: panel.key,
      angularComponent: loader.load(this.element, this.scopeProps, template),
    });

    this.setState({ loaded: true });
  }

  hasOverlayHeader() {
    const { panel } = this.props;
    const { data } = this.state;

    // always show normal header if we have time override
    if (data.request && data.request.timeInfo) {
      return false;
    }

    return !panel.hasTitle();
  }

  render() {
    const { dashboard, panel, isViewing, isEditing, plugin, onVisibilityChange, width, height } = this.props;
    const { isInView: isInViewInitially } = this.props;
    const { errorMessage, data } = this.state;
    const { transparent } = panel;

    const alertState = data.alertState?.state;

    const containerClassNames = classNames({
      'panel-container': true,
      'panel-container--absolute': isSoloRoute(locationService.getLocation().pathname),
      'panel-container--transparent': transparent,
      'panel-container--no-title': this.hasOverlayHeader(),
      'panel-has-alert': panel.alert !== undefined,
      [`panel-alert-state--${alertState}`]: alertState !== undefined,
    });

    const panelContentClassNames = classNames({
      'panel-content': true,
      'panel-content--no-padding': plugin.noPadding,
    });

    const content = (
      <div className={panelContentClassNames}>
        <div ref={(element) => (this.element = element)} className="panel-height-helper" />
      </div>
    );

    return (
      <div className={containerClassNames} aria-label={selectors.components.Panels.Panel.containerByTitle(panel.title)}>
        <PanelHeader
          panel={panel}
          dashboard={dashboard}
          title={panel.title}
          description={panel.description}
          links={panel.links}
          error={errorMessage}
          isViewing={isViewing}
          isEditing={isEditing}
          data={data}
          alertState={alertState}
        />
        {isInViewInitially ? (
          content
        ) : (
          <LazyLoader
            width={width}
            height={height - 32}
            onChange={(v) => {
              this.setState({ isInView: v });
              onVisibilityChange(v);
            }}
          >
            {() => content}
          </LazyLoader>
        )}
      </div>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => {
  return {
    angularComponent: getPanelStateForModel(state, props.panel)?.angularComponent,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = { setPanelAngularComponent };

export const PanelChromeAngular = connect(mapStateToProps, mapDispatchToProps)(PanelChromeAngularUnconnected);
