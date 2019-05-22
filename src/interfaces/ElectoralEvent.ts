export interface ElectoralEvent {
  name: string,
  startDateCreateElection: string,
  endDateCreateElection: string,
  startDateCreateElectoralRegister: string,
  endDateCreateElectoralRegister: string,
  startDateRegisterCandidate: string,
  endDateRegisterCandidate: string,
  startDateActiveElectoralEvent: string,
  endDateActiveElectoralEvent: string,
  publickey?: string,
}