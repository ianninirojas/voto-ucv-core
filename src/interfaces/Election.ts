// interfaces

import { Candidate } from "../interfaces/Candidate";

export interface Election {
  name: string,
  type: string,
  levelElection: string,
  typeCandidate: string,
  typeElector: string,
  facultyId: string,
  schoolId: string,
  allowedVotes: string,
  period: string,
  candidates: Candidate[]
}