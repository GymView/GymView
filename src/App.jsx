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
const theme = createTheme({});

export default function App() {
  const [active, setActive] = useState('Home');

  return (
    <MantineProvider defaultColorScheme="auto">
      <div style={{ display: 'flex' }}>

        <Navbar active={active} setActive = {setActive} />

        <main style={{ flex: 1, 
          display: 'flex', 
          flexDirection: 'column',  
          width: '80vw',
          backgroundColor: 'light-black'
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

