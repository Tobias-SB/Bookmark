// App.tsx
import React from "react";
import { registerRootComponent } from "expo";
import { App as RootApp } from "./src/App";

function App() {
  return <RootApp />;
}

registerRootComponent(App);

export default App;
