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

        <main style={{ flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          padding: '20px',
          width: '80vw',
          backgroundColor: 'light-black'
          }}>
          {active === 'Home' && <div>Maison</div> }
          {active === 'Carte' && <GymMap />}
          {active === 'Dashboard' && <div>Tableau de bord</div>}
          {active === 'Maintenance' && <div>Maintenance prédictive</div>}
          {active === 'Messages' && <div>Les problèmes</div>}
        </main>

      </div>
    </MantineProvider>
  );
}

