import { useEffect, useRef, useState } from "react"
import { GridStack } from "gridstack"
import "gridstack/dist/gridstack.min.css"
import "./GymPlanner.css"
import { GymApi } from "./ApiService"
//import {GYM_ID, API_KEY} from "./SharedVar.jsx"
const GYM_ID = 1;
const API_KEY = "xRxFCNDIM-0-hpEeccfLo9Sy08M1kUAS5nQDx-Q6pqQ";

// Charger dynamiquement les icônes SVG présentes dans src/assets/icons (Vite)
const iconModules = import.meta.glob('./assets/icons/*.svg', { eager: true, as: 'url' })
const ICONS = Object.fromEntries(
  Object.entries(iconModules).map(([p, url]) => {
    const name = p.split('/').pop().replace('.svg', '').toLowerCase()
    return [name, url]
  })
)
const ICON_KEYS = Object.keys(ICONS)
const DEFAULT_TYPE = ICON_KEYS.includes('treadmill') ? 'treadmill' : (ICON_KEYS[0] || 'treadmill')
// Composant GymPlanner avec gestion d'état (libre/utilisé/occupé)
export default function GymPlanner() {
  // État pour la machine sélectionnée lors de l'édition
  const [selectedMachine, setSelectedMachine] = useState(null)
  // Nom temporaire en cours d'édition
  const [machineName, setMachineName] = useState("")
  // État temporaire en cours d'édition (libre, utilise, occupe)
  const [machineState, setMachineState] = useState("libre")
  // Type de machine (id)
  const [machineType, setMachineType] = useState(DEFAULT_TYPE)
  // mapping des types vers icônes (réutilisable)
  const TYPE_ICONS = ICONS

  const gridRef = useRef(null)
  const gridInstance = useRef(null)
  const fileInputRef = useRef(null)

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
  // récupérer le label si présent (évite de prendre le texte de l'icône)
  const labelEl = content.querySelector('.machine-label')
  setMachineName(labelEl ? labelEl.innerText : content.innerText)
      // Récupérer l'état actuel depuis l'attribut data-state ou dataset
      const currentState = item.dataset.state || "libre"
      const currentType = item.dataset.type || "treadmill"
      setMachineState(currentState)
      setMachineType(currentType)
    })

    // charger la disposition sauvegardée (incluant l'état si enregistré)
    const savedLayout = localStorage.getItem("gym-layout")
    if (savedLayout) {
      try {
        const parsed = JSON.parse(savedLayout)
        // charger la grille
        gridInstance.current.load(parsed)
        // Après load, certains attributs (type/label/state) peuvent être dans l'objet sauvegardé
        // Réinjecter ces valeurs dans le DOM dataset pour que rebuildAllContents puisse les utiliser.
        parsed.forEach((node) => {
          const id = node.id || node.i || node.gsId
          if (!id) return
          const el = gridRef.current.querySelector(`[gs-id="${id}"]`)
          if (!el) return
          if (node.type) el.dataset.type = ('' + node.type).toLowerCase()
          if (node.label) el.dataset.label = node.label
          if (node.state) el.dataset.state = node.state
        })
        // après chargement, reconstruire systématiquement le DOM interne des tuiles
        rebuildAllContents()
      } catch (e) {
        console.warn('Invalid saved layout, falling back:', e)
      }
    }
  }, [])

  // Sauvegarder la disposition actuelle dans localStorage
  const saveLayout = () => {
    const layout = gridInstance.current.save()
    // Clean layout content to avoid storing raw HTML in `content` (we keep dataset values)
    try {
      const cleaned = layout.map((node) => {
        const el = gridRef.current.querySelector(`[gs-id="${node.id || node.i || node.gsId}"]`)
        const state = el?.dataset?.state || node.state || 'libre'
        const type = (el?.dataset?.type || node.type || DEFAULT_TYPE || '').toLowerCase()
        const label = el?.dataset?.label || ''
        // copy node but remove content
        const copy = { ...node }
        if ('content' in copy) delete copy.content
        copy.state = state
        copy.type = type
        if (label) copy.label = label
        return copy
      })
      localStorage.setItem("gym-layout", JSON.stringify(cleaned))

      console.log(JSON.stringify(cleaned))
      
      GymApi.updateMap(GYM_ID, API_KEY, JSON.stringify(cleaned))

      console.log("layout sauvegardé :", cleaned)
    } catch (err) {
      // fallback
      localStorage.setItem("gym-layout", JSON.stringify(layout))
      console.log("layout sauvegardé (fallback) :", layout, err)
    }
  }
const saveLayout2 = () => {
  // use cleaned saved layout
  saveLayout()
  const stored = localStorage.getItem("gym-layout")
  const json = stored || JSON.stringify(gridInstance.current.save(), null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = "gym-layout.json"
  link.click()
  console.log("layout exporté :", json)
}

  // Appliquer un layout parsé (array of nodes)
  const applyParsedLayout = (parsed) => {
    if (!gridInstance.current) return
    try {
      // try to clear existing widgets if API available
      if (typeof gridInstance.current.removeAll === 'function') {
        gridInstance.current.removeAll()
      }
    } catch (e) {
      // ignore
    }
    // load new layout
    gridInstance.current.load(parsed)
    // inject dataset values from parsed nodes into DOM elements
    parsed.forEach((node) => {
      const id = node.id || node.i || node.gsId
      if (!id) return
      const el = gridRef.current.querySelector(`[gs-id="${id}"]`)
      if (!el) return
      if (node.type) el.dataset.type = ('' + node.type).toLowerCase()
      if (node.label) el.dataset.label = node.label
      if (node.state) el.dataset.state = node.state
    })
    // rebuild DOM and persist
    rebuildAllContents()
    saveLayout()
  }

  // Handler pour le input file
  const onFileInputChange = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result
        const parsed = JSON.parse(text)
        if (!Array.isArray(parsed)) {
          console.warn('Imported layout should be an array of nodes')
        }
        applyParsedLayout(parsed)
      } catch (err) {
        console.error('Failed to parse layout file', err)
        alert('Impossible de lire le fichier JSON : ' + err.message)
      }
    }
    reader.readAsText(file)
    // reset input so same file can be selected again if needed
    e.target.value = ''
  }

  const openImportDialog = () => {
    if (fileInputRef.current) fileInputRef.current.click()
  }
  // Ajouter une nouvelle machine par défaut
  const addMachine = () => {
    const id = "machine-" + Date.now()
    // On ajoute le widget puis on met à jour le dataset et les classes
    const defaultType = machineType || 'treadmill'
    const iconSrc = TYPE_ICONS[defaultType] || treadmillIcon
    const defaultContent = `
      <div class="grid-stack-item-content machine machine-libre">
        <img class="machine-icon" src="${iconSrc}" alt="" />
        <span class="machine-label">Nouvelle machine</span>
      </div>
    `

    gridInstance.current.addWidget({
      x: 0,
      y: 0,
      w: 2,
      h: 2,
      id: id,
      state: "libre",
      type: defaultType,
      content: defaultContent
    })

    // Récupérer l'élément ajouté et définir son état dans dataset (sur .grid-stack-item)
    const machineEl = gridRef.current.querySelector(`[gs-id="${id}"]`)
    if (machineEl) {
      // stocker l'état sur l'élément wrapper afin que save() le prenne en compte
      machineEl.dataset.state = "libre"
      machineEl.dataset.type = defaultType
      machineEl.dataset.label = 'Nouvelle machine'
      const contentEl = machineEl.querySelector(".grid-stack-item-content")
      if (contentEl) {
        // s'assurer des classes CSS
        contentEl.classList.add("machine", "machine-libre")
        // Rebuild canonical content to avoid duplicates
        contentEl.innerHTML = ''
        const icon = document.createElement('img')
        icon.className = 'machine-icon'
        icon.src = iconSrc
        const span = document.createElement('span')
        span.className = 'machine-label'
        span.innerText = 'Nouvelle machine'
        contentEl.appendChild(icon)
        contentEl.appendChild(span)
      }
    }
    // garantir contenu canonique
    rebuildAllContents()
    // sauvegarde automatique après ajout
    saveLayout()
  }

  // Mettre à jour le nom et l'état de la machine sélectionnée
  const updateMachine = () => {
    const machine = gridRef.current.querySelector(
      `[gs-id="${selectedMachine}"]`
    )
    if (!machine) return
    // Mettre à jour le texte du contenu
    const contentEl = machine.querySelector(".grid-stack-item-content")
    // Mettre à jour l'icône + label (supprimer tout contenu précédent puis ajouter)
    const iconSrc = TYPE_ICONS[machineType] || treadmillIcon
    // clear previous children to avoid duplicates
    while (contentEl.firstChild) contentEl.removeChild(contentEl.firstChild)
    const icon = document.createElement('img')
    icon.className = 'machine-icon'
    icon.src = iconSrc
    const span = document.createElement('span')
    span.className = 'machine-label'
    span.innerText = machineName
    contentEl.appendChild(icon)
    contentEl.appendChild(span)
    // Mettre à jour l'état (dataset + classe CSS)
    const oldState = machine.dataset.state || "libre"
    // stocker l'état dans dataset
    machine.dataset.state = machineState
    // stocker le type
    machine.dataset.type = machineType
    // stocker le label pour une reconstruction fiable au reload
    machine.dataset.label = machineName
    // Mettre à jour les classes de couleur
    contentEl.classList.remove(`machine-${oldState}`)
    contentEl.classList.add(`machine-${machineState}`)
    // Fermer le formulaire
    setSelectedMachine(null)
    // sauvegarde automatique après modification
    saveLayout()
  }

  // Reconstruire le DOM interne de chaque tuile à partir des dataset (type + label)
  const rebuildAllContents = () => {
    if (!gridRef.current) return
    const items = gridRef.current.querySelectorAll('.grid-stack-item')
    items.forEach((item) => {
      const contentEl = item.querySelector('.grid-stack-item-content')
      if (!contentEl) return
      // normalize type
      const rawType = item.dataset.type || DEFAULT_TYPE || Object.keys(TYPE_ICONS)[0]
      const type = ('' + rawType).toLowerCase()
      // Determine label: prefer dataset.label, otherwise try to extract from existing content.
      let label = item.dataset.label || ''
      if (!label) {
        const labelEl = contentEl.querySelector('.machine-label')
        if (labelEl) {
          label = labelEl.innerText
        } else {
          // contentEl may contain raw HTML as text (e.g. '<img ...><span ...>Label</span>')
          const raw = (contentEl.innerText || '').trim()
          if (raw.startsWith('<')) {
            // parse the raw HTML string to extract text
            const tmp = document.createElement('div')
            tmp.innerHTML = raw
            const tmpLabel = tmp.querySelector('.machine-label')
            label = tmpLabel ? tmpLabel.innerText : (tmp.textContent || '').trim()
          } else {
            label = raw
          }
        }
      }
      const iconSrc = TYPE_ICONS[type] || Object.values(TYPE_ICONS)[0] || ''
      // clear and build
      contentEl.innerHTML = ''
      const icon = document.createElement('img')
      icon.className = 'machine-icon'
      icon.src = iconSrc
      const span = document.createElement('span')
      span.className = 'machine-label'
      span.innerText = label || 'Machine'
      contentEl.appendChild(icon)
      contentEl.appendChild(span)
      // ensure classes
      contentEl.classList.add('machine')
      const state = item.dataset.state || 'libre'
      contentEl.classList.remove('machine-libre', 'machine-utilise', 'machine-occupe')
      contentEl.classList.add(`machine-${state}`)
      // persist normalized values back to dataset to keep consistency
      item.dataset.type = type
      item.dataset.label = label || ''
    })
  }
  const deleteMachine = () => {
    const machine = gridRef.current.querySelector(
      `[gs-id="${selectedMachine}"]`
    )
    if (machine) {
      gridInstance.current.removeWidget(machine)
      setSelectedMachine(null)
      // sauvegarde automatique après suppression
      saveLayout()
    }
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
        <button onClick={saveLayout2}>
Exporter le layout
</button>
        <button onClick={openImportDialog} style={{ marginLeft: "10px" }}>
          Importer le layout
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onFileInputChange} />
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
          <div className="form-fields">
            <input
              value={machineName}
              onChange={(e) => setMachineName(e.target.value)}
              placeholder="Nom de la machine"
              className="form-input"
            />
            <select
              value={machineState}
              onChange={(e) => setMachineState(e.target.value)}
              className="form-select"
            >
              <option value="libre">Libre</option>
              <option value="utilise">Utilisé</option>
              <option value="occupe">Occupé</option>
            </select>
            <div className="type-row">
              <img className="type-preview" src={TYPE_ICONS[machineType] || (Object.values(TYPE_ICONS)[0] || '')} alt="type" />
              <select
                value={machineType}
                onChange={(e) => setMachineType(e.target.value)}
                className="form-select"
              >
                {Object.keys(TYPE_ICONS).map((key) => (
                  <option key={key} value={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-save" onClick={updateMachine}>
              Enregistrer
            </button>
            <button className="btn-delete" onClick={deleteMachine}>
              Supprimer
            </button>
          </div>
        </div>
      )}
    </>
  )
}