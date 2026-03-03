
export const Machine = ({ color = "currentColor", ...props }) => (
  <svg width="50" height="50" viewBox="0 0 100 100" {...props}>
    <rect x="20" y="20" width="60" height="60" fill={color} rx="5" />
    <circle cx="50" cy="50" r="10" fill="white" />
  </svg>
);