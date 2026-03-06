import { useEffect, useRef, useState } from "react"
import { GridStack } from "gridstack"
import "gridstack/dist/gridstack.min.css"
import "./GymPlanner.css"

// Composant GymPlanner avec gestion d'état (libre/utilisé/occupé)
export default function GymPlanner() {
  // État pour la machine sélectionnée lors de l'édition
  const [selectedMachine, setSelectedMachine] = useState(null)
  // Nom temporaire en cours d'édition
  const [machineName, setMachineName] = useState("")
  // État temporaire en cours d'édition (libre, utilise, occupe)
  const [machineState, setMachineState] = useState("libre")

  const gridRef = useRef(null)
  const gridInstance = useRef(null)

  useEffect(() => {
    // création de la grille
    gridInstance.current = GridStack.init({
      column: 12,
      cellHeight: 100,
      float: true
    }, gridRef.current)

    // écoute du double‑clic pour éditer une machine
    gridRef.current.addEventListener("dblclick", (e) => {
      const item = e.target.closest(".grid-stack-item")
      if (!item) return
      const id = item.getAttribute("gs-id")
      const content = item.querySelector(".grid-stack-item-content")
      // Mémoriser l'élément à éditer
      setSelectedMachine(id)
      setMachineName(content.innerText)
      // Récupérer l'état actuel depuis l'attribut data-state ou dataset
      const currentState = item.dataset.state || "libre"
      setMachineState(currentState)
    })

    // charger la disposition sauvegardée (incluant l'état si enregistré)
    const savedLayout = localStorage.getItem("gym-layout")
    if (savedLayout) {
      gridInstance.current.load(JSON.parse(savedLayout))
    }
  }, [])

  // Sauvegarder la disposition actuelle dans localStorage
  const saveLayout = () => {
    const layout = gridInstance.current.save()
    localStorage.setItem("gym-layout", JSON.stringify(layout))
    console.log("layout sauvegardé :", layout)
  }

  // Ajouter une nouvelle machine par défaut
  const addMachine = () => {
    const id = "machine-" + Date.now()
    gridInstance.current.addWidget({
      x: 0,
      y: 0,
      w: 2,
      h: 2,
      id: id,
      state: "libre", // stocké dans dataset.state
      // le contenu inclut les classes machine + state
      content: `
        <div class="grid-stack-item-content machine machine-libre">
          Nouvelle machine
        </div>
      `
    })
  }

  // Mettre à jour le nom et l'état de la machine sélectionnée
  const updateMachine = () => {
    const machine = gridRef.current.querySelector(
      `[gs-id="${selectedMachine}"]`
    )
    if (!machine) return
    // Mettre à jour le texte du contenu
    const contentEl = machine.querySelector(".grid-stack-item-content")
    contentEl.innerText = machineName
    // Mettre à jour l'état (dataset + classe CSS)
    const oldState = machine.dataset.state || "libre"
    // stocker l'état dans dataset
    machine.dataset.state = machineState
    // Mettre à jour les classes de couleur
    contentEl.classList.remove(`machine-${oldState}`)
    contentEl.classList.add(`machine-${machineState}`)
    // Fermer le formulaire
    setSelectedMachine(null)
  }

  return (
    <>
      {/* Barre d'actions */}
      <div style={{ marginBottom: "20px" }}>
        <button onClick={addMachine}>
          Ajouter une machine
        </button>
        <button onClick={saveLayout} style={{ marginLeft: "10px" }}>
          Sauvegarder la salle
        </button>
      </div>
      {/* Grille principale */}
      <div className="grid-stack" ref={gridRef}>
        {/* Machines initiales avec état par défaut "libre" */}
        <div className="grid-stack-item" gs-id="pec" gs-x="0" gs-y="0" gs-w="2" gs-h="2" data-state="libre">
          <div className="grid-stack-item-content machine machine-libre">
            Machine Pec
          </div>
        </div>
        <div className="grid-stack-item" gs-id="biceps" gs-x="3" gs-y="0" gs-w="2" gs-h="2" data-state="libre">
          <div className="grid-stack-item-content machine machine-libre">
            Machine Biceps
          </div>
        </div>
      </div>
      {/* Formulaire d'édition */}
      {selectedMachine && (
        <div className="machine-form">
          <h3>Modifier la machine</h3>
          <input
            value={machineName}
            onChange={(e) => setMachineName(e.target.value)}
            placeholder="Nom de la machine"
          />
          <select
            value={machineState}
            onChange={(e) => setMachineState(e.target.value)}
            style={{ marginTop: "10px" }}
          >
            <option value="libre">Libre</option>
            <option value="utilise">Utilisé</option>
            <option value="occupe">Occupé</option>
          </select>
          <button onClick={updateMachine} style={{ marginTop: "10px" }}>
            Enregistrer
          </button>
        </div>
      )}
    </>
  )
}