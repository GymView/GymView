import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import { NavbarSimple } from './NavbarSimple';


const theme = createTheme({});

export default function App() {
  return (
    <MantineProvider defaultColorScheme="auto">
      <div style={{ display: 'flex' }}>
        <NavbarSimple />
        <main style={{ padding: '20px' }}>
          <h1>Contenu de mon Dashboard</h1>
        </main>
      </div>
    </MantineProvider>
  );
}