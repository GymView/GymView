import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import { Navbar } from './Navbar';
import { useState } from 'react';
import Home from './Home';
import GymMap from './GymMap';
import Dashboard from './components/Dashboard';
import Maintenance from './Maintenance';
import Messages from './Messages';
import GymPlanner from "./GymPlanner"

const theme = createTheme({
  fontFamily: 'Poppins, sans-serif',
  primaryColor: 'green',
  colors: {
    green: [
      '#e8fdf1', '#c0f9d6', '#86f2b0', '#00e676', '#00d166',
      '#00b359', '#009e50', '#008542', '#006e36', '#005228',
    ],
  },
  defaultRadius: 'md',
  black: '#040f1a',
  white: '#ffffff',
  components: {
    Paper: {
      defaultProps: {
        bg: 'rgba(255,255,255,0.04)',
      },
    },
  },
});

export default function App() {
  const [active, setActive] = useState('Home');

  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <div style={{ display: 'flex' }}>

        <Navbar active={active} setActive = {setActive} />

        <main style={{ flex: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '80vw',
          backgroundColor: 'var(--bg-primary)'
          }}>
          {active === 'Home' && <Home /> }
         
          {active === 'Dashboard' && <Dashboard />}
          {active === 'Carte' && <GymPlanner />}
          {active === 'Maintenance' && <Maintenance />}
          {active === 'Messages' && <Messages />}
        </main>

      </div>
    </MantineProvider>
  );
}

