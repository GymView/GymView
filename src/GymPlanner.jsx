import { useEffect, useRef } from "react"
import { GridStack } from "gridstack"
import "gridstack/dist/gridstack.min.css"

export default function GymPlanner() {

  const gridRef = useRef(null)
  const gridInstance = useRef(null)

  useEffect(() => {

    // création de la grille
    gridInstance.current = GridStack.init({
      column: 12,
      cellHeight: 80,
      float: true
    }, gridRef.current)

    // charger la disposition sauvegardée
    const savedLayout = localStorage.getItem("gym-layout")

    if (savedLayout) {
      gridInstance.current.load(JSON.parse(savedLayout))
    }

  }, [])

  const saveLayout = () => {

    const layout = gridInstance.current.save()

    localStorage.setItem(
      "gym-layout",
      JSON.stringify(layout)
    )

    console.log("layout sauvegardé :", layout)
  }
const addMachine = () => {

  const id = "machine-" + Date.now()

  gridInstance.current.addWidget({
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    id: id,
    content: `
        Nouvelle machine
    `
  })

}
  return (
    
    <>
    <div style={{marginBottom: "20px"}}>
      <button onClick={addMachine}>
        Ajouter une machine
      </button>

      <button onClick={saveLayout} style={{marginLeft:"10px"}}>
        Sauvegarder la salle
      </button>
    </div>

      <div className="grid-stack" ref={gridRef}>

        <div className="grid-stack-item" gs-id="pec" gs-x="0" gs-y="0" gs-w="2" gs-h="2">
          <div className="grid-stack-item-content">
            Machine Pec
          </div>
        </div>

        <div className="grid-stack-item" gs-id="biceps" gs-x="3" gs-y="0" gs-w="2" gs-h="2">
          <div className="grid-stack-item-content">
            Machine Biceps
          </div>
        </div>

      </div>
    </>
  )
}