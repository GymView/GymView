import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import { Navbar } from './Navbar';
import { GymMap } from './GymMap';
import { useState } from 'react';

const theme = createTheme({});

export default function App() {
  const [active, setActive] = useState('Home');

  return (
    <MantineProvider defaultColorScheme="auto">
      <div style={{ display: 'flex' }}>

        <Navbar updateActive = {setActive} />

        <main style={{ flex: 1, padding: '20px' }}>
          {active === 'Home' && <GymMap />}
          {active === 'Carte' && <></>}
          {active === 'Dashboard' && <></>}
          {active === 'Maintenance' && <></>}
          {active === 'Messages' && <></>}
        </main>

      </div>
    </MantineProvider>
  );
}

