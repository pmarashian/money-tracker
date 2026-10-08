import { useSearchParams } from 'react-router-dom';
import { RetroLoaderPage } from '../components/RetroLoaderPage';
import { RetroLoader } from '../components/RetroLoader';

const SCREENS: Record<string, { title: string; label: string }> = {
  home: { title: 'Money Tracker', label: 'LOADING SNAPSHOT' },
  expenses: { title: 'Expenses', label: 'LOADING EXPENSES' },
};

/** Dev-only route for capturing loader screenshots (stripped from production via App.tsx guard). */
const DevRetroLoaderPreview: React.FC = () => {
  const [params] = useSearchParams();
  const screen = params.get('screen') ?? 'home';
  const spriteOnly = params.get('sprite') === '1';

  if (spriteOnly) {
    return (
      <div
        className="rr-app rr-loader-screen"
        style={{ background: '#000020' }}
      >
        <div style={{ transform: 'scale(2.5)', transformOrigin: 'center' }}>
          <RetroLoader label="LOADING" />
        </div>
      </div>
    );
  }

  const config = SCREENS[screen] ?? SCREENS.home;
  return (
    <RetroLoaderPage
      title={config.title}
      label={config.label}
      showLoader
    />
  );
};

export default DevRetroLoaderPreview;
