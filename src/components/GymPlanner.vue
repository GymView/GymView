<template>
  <!-- Conteneur gridstack -->
  <div class="grid-stack" ref="gridRef">
    <!-- Chaque widget représente une machine -->
    <div
      v-for="item in items"
      :key="item.id"
      class="grid-stack-item"
      :gs-id="item.id"
      :gs-x="item.grid.x"
      :gs-y="item.grid.y"
      :gs-w="item.grid.w"
      :gs-h="item.grid.h"
    >
      <!-- Contenu du widget, avec double‑clic pour modifier -->
      <div class="grid-stack-item-content" @dblclick="editItem(item)">
        {{ item.name }}
      </div>
    </div>

    <!-- Fenêtre modale simple pour éditer un équipement -->
    <div v-if="editingItem" class="modal" @click.self="cancelEdit">
      <div class="modal-content">
        <h2>Modifier l’équipement</h2>
        <label>
          Nom&nbsp;:
          <input v-model="editingItem.name" />
        </label>
        <label>
          Largeur (colonnes)&nbsp;:
          <input type="number" v-model.number="editingItem.grid.w" min="1" />
        </label>
        <label>
          Hauteur (lignes)&nbsp;:
          <input type="number" v-model.number="editingItem.grid.h" min="1" />
        </label>
        <div class="modal-actions">
          <button @click="saveItem">Enregistrer</button>
          <button @click="cancelEdit">Annuler</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { GridStack } from 'gridstack'
import 'gridstack/dist/gridstack.min.css'
import 'gridstack/dist/gridstack-extra.min.css'

// Modèle de données représentant les équipements de la salle
const items = ref([
  {
    id: 1,
    name: 'Machine à pectoraux',
    grid: { x: 0, y: 0, w: 3, h: 2 },
  },
  {
    id: 2,
    name: 'Machine à biceps',
    grid: { x: 3, y: 0, w: 2, h: 2 },
  },
  {
    id: 3,
    name: 'Machine à triceps',
    grid: { x: 0, y: 2, w: 2, h: 2 },
  },
])

const gridRef = ref(null)
const editingItem = ref(null)
let grid // référence à l’instance Gridstack

onMounted(() => {
  // Initialise la grille avec 12 colonnes et 80px de hauteur de cellule. L’option
  // `float: true` permet le placement libre des widgets.
  grid = GridStack.init({ column: 12, cellHeight: 80, float: true }, gridRef.value)

  // Surveiller les changements (déplacement/redimensionnement) pour mettre à jour
  // nos données. Chaque changement fournit un tableau d’éléments modifiés.
  grid.on('change', (event, changedItems) => {
    changedItems.forEach((ci) => {
      const item = items.value.find((i) => i.id === Number(ci.id))
      if (item) {
        item.grid.x = ci.x
        item.grid.y = ci.y
        item.grid.w = ci.w
        item.grid.h = ci.h
      }
    })
  })
})

// Ouvre la fenêtre modale en copiant l’équipement pour édition
function editItem(item) {
  editingItem.value = JSON.parse(JSON.stringify(item))
}

// Enregistre les modifications et met à jour la grille
function saveItem() {
  const idx = items.value.findIndex((i) => i.id === editingItem.value.id)
  if (idx >= 0) {
    // Copie les nouvelles valeurs dans la liste des équipements
    items.value[idx] = JSON.parse(JSON.stringify(editingItem.value))
    // Met à jour le widget visuellement
    const node = grid.getNodeFromElement(
      gridRef.value.querySelector(`.grid-stack-item[gs-id="${editingItem.value.id}"]`)
    )
    if (node) {
      grid.update(node.el, editingItem.value.grid)
    }
  }
  editingItem.value = null
}

// Ferme la fenêtre modale sans enregistrer
function cancelEdit() {
  editingItem.value = null
}
</script>

<style scoped>
/* Styles de base pour le grid */
.grid-stack {
  background: #f4f4f4;
  min-height: 500px;
}
.grid-stack-item-content {
  background-color: #18bc9c;
  color: #fff;
  border-radius: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  cursor: pointer;
  user-select: none;
}
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}
.modal-content {
  background: #fff;
  padding: 20px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 300px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.modal-actions button {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  background-color: #18bc9c;
  color: #fff;
  cursor: pointer;
}
.modal-actions button:last-child {
  background-color: #ccc;
  color: #000;
}
</style>