import { useEffect, useRef } from "react"
import { GridStack } from "gridstack"
import "gridstack/dist/gridstack.min.css"

export default function GymPlanner() {

  const gridRef = useRef(null)

  useEffect(() => {

    GridStack.init({
      column: 12,
      cellHeight: 80,
      float: true
    }, gridRef.current)

  }, [])

  return (
    <div className="grid-stack" ref={gridRef}>

      <div className="grid-stack-item" gs-x="0" gs-y="0" gs-w="3" gs-h="2">
        <div className="grid-stack-item-content">
          Machine Pec
        </div>
      </div>

      <div className="grid-stack-item" gs-x="3" gs-y="0" gs-w="2" gs-h="2">
        <div className="grid-stack-item-content">
          Machine Biceps
        </div>
      </div>

      <div className="grid-stack-item" gs-x="5" gs-y="0" gs-w="2" gs-h="2">
        <div className="grid-stack-item-content">
          Machine Triceps
        </div>
      </div>

    </div>
  )
}