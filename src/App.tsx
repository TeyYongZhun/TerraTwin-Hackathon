import { useEffect } from 'react';
import { MapView } from './map/MapView';
import { useApp, useAppPick } from './store/app';
import { getHealth } from './lib/api';
import { Intro } from './features/intro/Intro';
import { TopBar } from './features/shell/TopBar';
import { Toasts } from './features/shell/Toasts';
import { AssumptionsModal } from './features/shell/AssumptionsModal';
import { SiteList } from './features/solartwin/SiteList';
import { SiteDrawer } from './features/solartwin/SiteDrawer';
import { TimeBar } from './features/solartwin/TimeBar';
import { LayerDock } from './features/solartwin/LayerDock';
import { EcoSpec, PanelSpec } from './features/ecospec/EcoSpec';
import { Dashboard } from './features/dashboard/Dashboard';
import { PrintReport } from './features/dashboard/PrintReport';
import { Copilot } from './features/copilot/Copilot';
import { DemoRunner } from './features/demo/DemoRunner';

export default function App() {
  const { started, module, selectedId, set } = useAppPick('started', 'module', 'selectedId', 'set');

  useEffect(() => { getHealth().then((ai) => set({ ai })); }, [set]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); set({ copilotOpen: !useApp.getState().copilotOpen }); }
      if (e.key === 'Escape') set({ copilotOpen: false, assumptionsOpen: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [set]);

  const startDemo = () => set({ demoStep: 0, copilotOpen: false });
  const stopDemo = () => set({ demoStep: null, playing: false });

  return (
    <>
      <div className="relative h-full w-full overflow-hidden print:hidden">
        <MapView />
        {!started && <Intro onDemo={startDemo} />}
        {started && (
          <div className="pointer-events-none absolute inset-0">
            <TopBar onDemo={startDemo} onStopDemo={stopDemo} />
            {module === 'solar' && (
              <>
                <SiteList />
                {selectedId && <SiteDrawer />}
                <div className="pointer-events-none absolute bottom-3 left-[356px] z-10 flex items-end justify-between gap-3" style={{ right: selectedId ? 426 : 12 }}>
                  <TimeBar className="min-w-0 max-w-[620px] flex-1" />
                  <LayerDock className="shrink-0" />
                </div>
              </>
            )}
            {module === 'panelspec' && <PanelSpec />}
            {module === 'ecospec' && <EcoSpec />}
            {module === 'dashboard' && <Dashboard />}
          </div>
        )}
        <AssumptionsModal />
        <Copilot />
        <DemoRunner />
        <Toasts />
      </div>
      <PrintReport />
    </>
  );
}
