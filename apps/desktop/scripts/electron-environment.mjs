export function createElectronEnvironment(parentEnvironment) {
  const environment = { ...parentEnvironment };
  delete environment.ELECTRON_RUN_AS_NODE;
  return environment;
}
