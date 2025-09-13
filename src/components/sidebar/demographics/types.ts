export interface PopulationData {
  total: number;
}

export interface EmploymentData {
  rate: number;
}

export type AgeDistribution = {
  "0-15": number;
  "16-29": number;
  "30-44": number;
  "45-64": number;
  "65+": number;
};
export type NewDemographicData = {
  population: PopulationData;
  employment: EmploymentData;
  age_distribution: AgeDistribution;
  lastUpdated: string;
};
