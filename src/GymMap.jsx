import { Paper, Title, Text, SimpleGrid, Tooltip } from '@mantine/core';
import { Machine } from './Machine';

export default function GymMap() {
  return (
    <Paper shadow="xs" p="xl" withBorder style={{ backgroundColor: 'blak' }}>
      <Title order={2} mb="xl">Plan de la Salle</Title>
      
      {/* Utilisation d'une grille pour aligner les machines proprement */}
      <SimpleGrid cols={40} spacing="xl">
        <Tooltip label="Machine Pec Deck - Disponible">
          <div style={{ cursor: 'pointer', textAlign: 'center' }}>
            <Machine color="var(--mantine-color-blue-6)" />
            <Text size="xs">Pec Deck</Text>
          </div>
        </Tooltip>
        
        {/* Ajoute d'autres machines ici */}
      </SimpleGrid>
    </Paper>
  );
}