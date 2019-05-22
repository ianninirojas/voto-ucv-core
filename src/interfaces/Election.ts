export interface Election {
  id?: string,
  name: string,
  type: string,
  levelElection: string,
  typeCandidate: string,
  typeElector: string,
  facultyId: string,
  schoolId: string,
  allowedVotes: string,
  period: string,
}