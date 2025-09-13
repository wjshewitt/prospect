// src/services/pdf-report-service.ts
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import Handlebars from "handlebars";
import type { ProximityData } from "./proximity-service";
import type { IntegratedData } from "./data-integrator-service";
import type { Shape, ElevationGrid } from "@/lib/types";

interface ReportData {
  siteName: string;
  projectBoundary: Shape;
  assessmentData: ProximityData;
  integratedData: IntegratedData;
  elevationGrid: ElevationGrid;
  aiSummary?: string | null;
  extensiveReport?: {
    detailedAnalysis: string;
    risksOpportunities: string;
    recommendations: string;
  } | null;
  visualRecs?: string[];
  mapImage?: string;
  generatedAt: string;
}

interface PDFOptions {
  includeCharts: boolean;
  includeHighResMap: boolean;
  template: "standard" | "detailed" | "executive";
  orientation: "portrait" | "landscape";
}

// Simple string templates for different report formats
const templates = {
  standard: `
  <div style="font-family: Arial, sans-serif; width: 100%; max-width: min(800px, 100vw - 32px); margin: 0 auto; padding: 16px; box-sizing: border-box; overflow-x: hidden; overflow-wrap: anywhere;">
    <header style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px;">
      <h1 style="color: #333; margin: 0;">{{siteName}}</h1>
      <h2 style="color: #666; margin: 10px 0;">Site Assessment Report</h2>
      <p style="color: #999; margin: 5px 0;">Generated: {{generatedAt}}</p>
    </header>

    {{#if mapImage}}
    <section style="margin-bottom: 30px;">
      <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Site Map</h3>
      <img src="{{mapImage}}" alt="Site Map" style="width: 100%; height: auto; border: 1px solid #ddd; margin-top: 15px;" />
    </section>
    {{/if}}

    <section style="margin-bottom: 30px;">
      <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Site Overview</h3>
      <div style="margin-top: 15px;">
        <div style="margin-bottom: 10px;"><strong>Area:</strong> {{areaAcres}} acres ({{areaSqm}} sqm)</div>
        <div><strong>Validation:</strong> {{#if assessmentData.validation.isValid}}<span style="color: green;">Valid</span>{{else}}<span style="color: red;">Issues Found</span>{{/if}}</div>
      </div>
    </section>

    <section style="margin-bottom: 30px;">
      <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Proximity Analysis</h3>
      <div style="margin-top: 15px;">
        {{#each proximityItems}}
        <div style="margin-bottom: 10px; padding: 8px; background: #f9f9f9; border-radius: 3px;">
          <strong>{{name}}:</strong> {{distance}} km ({{distanceMiles}} miles)
        </div>
        {{/each}}
      </div>
    </section>

    {{#if integratedData.demographic}}
    <section style="margin-bottom: 30px;">
      <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Demographic Insights</h3>
      <div style="margin-top: 15px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <h4 style="margin-bottom: 10px; color: #555;">Key Metrics</h4>
            <div style="margin-bottom: 8px;"><strong>Population:</strong> {{integratedData.demographic.population}}</div>
            <div style="margin-bottom: 8px;"><strong>Density:</strong> {{integratedData.demographic.density}}/km²</div>
            <div style="margin-bottom: 8px;"><strong>Median Age:</strong> {{integratedData.demographic.medianAge}}</div>
            <div style="margin-bottom: 8px;"><strong>Average Income:</strong> £{{integratedData.demographic.averageIncomeGbp}}</div>
            <div style="margin-bottom: 8px;"><strong>Employment Rate:</strong> {{integratedData.demographic.employmentRate}}%</div>
            <div><strong>Higher Education:</strong> {{integratedData.demographic.educationLevels.higher}}%</div>
          </div>
          <div>
            <h4 style="margin-bottom: 10px; color: #555;">Age Distribution</h4>
            <div style="margin-bottom: 5px;"><strong>0-14:</strong> {{safeAgeDistribution.0_14}}%</div>
            <div style="margin-bottom: 5px;"><strong>15-24:</strong> {{safeAgeDistribution.15_24}}%</div>
            <div style="margin-bottom: 5px;"><strong>25-44:</strong> {{safeAgeDistribution.25_44}}%</div>
            <div style="margin-bottom: 5px;"><strong>45-64:</strong> {{safeAgeDistribution.45_64}}%</div>
            <div><strong>65+:</strong> {{safeAgeDistribution.65_plus}}%</div>
          </div>
        </div>
      </div>
    </section>
    {{/if}}

    {{#if integratedData.environmental}}
    <section style="margin-bottom: 30px;">
      <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Environmental Analysis</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
        {{#if integratedData.environmental.flood}}
        <div style="border: 1px solid #eee; padding: 15px; border-radius: 5px;">
          <h4 style="margin: 0 0 10px 0;">Flood Risk</h4>
          <div><strong>Risk Level:</strong> {{integratedData.environmental.flood.riskLevel}}</div>
          <div><strong>Affected Area:</strong> {{integratedData.environmental.flood.percentageAffected}}%</div>
        </div>
        {{/if}}
        {{#if integratedData.environmental.soil}}
        <div style="border: 1px solid #eee; padding: 15px; border-radius: 5px;">
          <h4 style="margin: 0 0 10px 0;">Soil Quality</h4>
          <div><strong>Soil Type:</strong> {{integratedData.environmental.soil.soilType}}</div>
          <div><strong>Quality:</strong> {{integratedData.environmental.soil.quality}}</div>
        </div>
        {{/if}}
      </div>
    </section>
    {{/if}}

    {{#if aiSummary}}
    <section style="margin-bottom: 30px;">
      <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Executive Summary</h3>
      <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin-top: 15px; border-left: 4px solid #007bff;">
        {{aiSummary}}
      </div>
    </section>
    {{/if}}

    {{#if visualRecs}}
    <section style="margin-bottom: 30px;">
      <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Visual Recommendations</h3>
      <ul style="margin-top: 15px; padding-left: 20px;">
        {{#each visualRecs}}
        <li style="margin-bottom: 8px;">{{this}}</li>
        {{/each}}
      </ul>
    </section>
    {{/if}}

    {{#if extensiveReport}}
    <section style="margin-bottom: 30px;">
      <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Detailed Analysis</h3>
      <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin-top: 15px;">
        {{extensiveReport.detailedAnalysis}}
      </div>
    </section>
    <section style="margin-bottom: 30px;">
      <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Risks and Opportunities</h3>
      <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin-top: 15px;">
        {{extensiveReport.risksOpportunities}}
      </div>
    </section>
    <section style="margin-bottom: 30px;">
      <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Recommendations</h3>
      <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin-top: 15px;">
        {{extensiveReport.recommendations}}
      </div>
    </section>
    {{/if}}

    <footer style="text-align: center; color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
      <p>Report generated by Prospect Site Assessment System</p>
    </footer>
  </div>
 `,

  detailed: `
<div style="font-family: Arial, sans-serif; width: 100%; max-width: min(1000px, 100vw - 32px); margin: 0 auto; padding: 16px; box-sizing: border-box; overflow-x: hidden; overflow-wrap: anywhere;">
  <header style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px;">
    <h1 style="color: #333; margin: 0;">{{siteName}}</h1>
    <h2 style="color: #666; margin: 10px 0;">Detailed Site Assessment Report</h2>
    <p style="color: #999; margin: 5px 0;">Generated: {{generatedAt}}</p>
  </header>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
    <div>
      {{#if mapImage}}
      <div style="margin-bottom: 30px;">
        <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Site Map</h3>
        <img src="{{mapImage}}" alt="Site Map" style="width: 100%; height: auto; border: 1px solid #ddd; margin-top: 15px;" />
      </div>
      {{/if}}

      <section style="margin-bottom: 30px;">
        <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Site Overview</h3>
        <div style="margin-top: 15px;">
          <div style="margin-bottom: 10px;"><strong>Area:</strong> {{areaAcres}} acres</div>
          <div style="margin-bottom: 10px;"><strong>Square Meters:</strong> {{areaSqm}}</div>
          <div><strong>Validation Status:</strong> {{#if assessmentData.validation.isValid}}<span style="color: green;">Valid</span>{{else}}<span style="color: red;">Issues Found</span>{{/if}}</div>
        </div>
      </section>
    </div>

    <div>
      <section style="margin-bottom: 30px;">
        <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Proximity Analysis</h3>
        <div style="margin-top: 15px;">
          {{#each proximityItems}}
          <div style="margin-bottom: 10px; padding: 8px; background: #f9f9f9; border-radius: 3px;">
            <strong>{{name}}:</strong> {{distance}} km ({{distanceMiles}} miles)
          </div>
          {{/each}}
        </div>
      </section>

      {{#if integratedData.demographic}}
      <section style="margin-bottom: 30px;">
        <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Demographic Insights</h3>
        <div style="margin-top: 15px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <h4 style="margin-bottom: 10px; color: #555;">Key Metrics</h4>
              <div style="margin-bottom: 8px;"><strong>Population:</strong> {{integratedData.demographic.population}} (UK: {{integratedData.demographic.nationalAverages.population}})</div>
              <div style="margin-bottom: 8px;"><strong>Density:</strong> {{integratedData.demographic.density}}/km² (UK: {{integratedData.demographic.nationalAverages.density}})</div>
              <div style="margin-bottom: 8px;"><strong>Median Age:</strong> {{integratedData.demographic.medianAge}} (UK: {{integratedData.demographic.nationalAverages.medianAge}})</div>
              <div style="margin-bottom: 8px;"><strong>Average Income:</strong> £{{integratedData.demographic.averageIncomeGbp}} (UK: £{{integratedData.demographic.nationalAverages.averageIncomeGbp}})</div>
              <div style="margin-bottom: 8px;"><strong>Employment Rate:</strong> {{integratedData.demographic.employmentRate}}% (UK: {{integratedData.demographic.nationalAverages.employmentRate}}%)</div>
              <div style="margin-bottom: 8px;"><strong>Higher Education:</strong> {{integratedData.demographic.educationLevels.higher}}% (UK: {{integratedData.demographic.nationalAverages.educationHigher}}%)</div>
              <div style="margin-bottom: 8px;"><strong>Affordability Index:</strong> {{integratedData.demographic.housingAffordabilityIndex}}x (UK: {{integratedData.demographic.nationalAverages.affordabilityIndex}}x)</div>
              <div><strong>Ownership Rate:</strong> {{integratedData.demographic.propertyOwnershipRate}}% (UK: {{integratedData.demographic.nationalAverages.ownershipRate}}%)</div>
            </div>
            <div>
              <h4 style="margin-bottom: 10px; color: #555;">Age Distribution</h4>
              <div style="margin-bottom: 5px;"><strong>0-14:</strong> {{safeAgeDistribution.0_14}}%</div>
              <div style="margin-bottom: 5px;"><strong>15-24:</strong> {{safeAgeDistribution.15_24}}%</div>
              <div style="margin-bottom: 5px;"><strong>25-44:</strong> {{safeAgeDistribution.25_44}}%</div>
              <div style="margin-bottom: 5px;"><strong>45-64:</strong> {{safeAgeDistribution.45_64}}%</div>
              <div><strong>65+:</strong> {{safeAgeDistribution.65_plus}}%</div>
              <h4 style="margin-top: 15px; margin-bottom: 10px; color: #555;">Developer Insights</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li>{{#if (gt integratedData.demographic.averageIncomeGbp integratedData.demographic.nationalAverages.averageIncomeGbp)}}Higher income supports luxury housing viability{{else}}Affordable housing opportunities{{/if}}</li>
                <li>{{#if (gt integratedData.demographic.employmentRate integratedData.demographic.nationalAverages.employmentRate)}}Strong employment indicates stable demand{{else}}Focus on workforce housing{{/if}}</li>
                <li>{{#if (gt integratedData.demographic.medianAge integratedData.demographic.nationalAverages.medianAge)}}Mature population favors senior living{{else}}Young demographics suit family developments{{/if}}</li>
              </ul>
            </div>
          </div>
          <div style="margin-top: 15px; font-size: 12px; color: #666;">
            <strong>Data Source:</strong> {{integratedData.demographic.source}} | <strong>Last Updated:</strong> {{integratedData.demographic.timestamp}} | <strong>Location Type:</strong> {{integratedData.demographic.locationType}}
          </div>
        </div>
      </section>
      {{/if}}
    </div>
  </div>

  {{#if integratedData.environmental}}
  <section style="margin-bottom: 30px;">
    <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Environmental Analysis</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
      {{#if integratedData.environmental.flood}}
      <div style="border: 1px solid #eee; padding: 15px; border-radius: 5px;">
        <h4 style="margin: 0 0 10px 0;">Flood Risk Assessment</h4>
        <div><strong>Risk Level:</strong> {{integratedData.environmental.flood.riskLevel}}</div>
        <div><strong>Description:</strong> {{integratedData.environmental.flood.description}}</div>
        <div><strong>Affected Area:</strong> {{integratedData.environmental.flood.percentageAffected}}%</div>
      </div>
      {{/if}}
      {{#if integratedData.environmental.soil}}
      <div style="border: 1px solid #eee; padding: 15px; border-radius: 5px;">
        <h4 style="margin: 0 0 10px 0;">Soil Quality Analysis</h4>
        <div><strong>Soil Type:</strong> {{integratedData.environmental.soil.soilType}}</div>
        <div><strong>Quality:</strong> {{integratedData.environmental.soil.quality}}</div>
        <div><strong>Drainage:</strong> {{integratedData.environmental.soil.drainage}}</div>
      </div>
      {{/if}}
    </div>
  </section>
  {{/if}}

  {{#if aiSummary}}
  <section style="margin-bottom: 30px;">
    <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">AI Assessment Summary</h3>
    <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin-top: 15px; border-left: 4px solid #007bff;">
      {{aiSummary}}
    </div>
  </section>
  {{/if}}

  <footer style="text-align: center; color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
    <p>Detailed report generated by Prospect Site Assessment System</p>
  </footer>
</div>
`,

  executive: `
<div style="font-family: Arial, sans-serif; width: 100%; max-width: min(900px, 100vw - 32px); margin: 0 auto; padding: 16px; box-sizing: border-box; overflow-x: hidden; overflow-wrap: anywhere;">
  <header style="text-align: center; border-bottom: 3px solid #007bff; padding-bottom: 20px; margin-bottom: 30px;">
    <h1 style="color: #333; margin: 0; font-size: 28px;">{{siteName}}</h1>
    <h2 style="color: #666; margin: 10px 0; font-size: 20px;">Executive Site Assessment Report</h2>
    <p style="color: #999; margin: 5px 0; font-size: 14px;">Generated: {{generatedAt}}</p>
  </header>

  <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 30px; margin-bottom: 30px;">
    {{#if mapImage}}
    <div>
      <h3 style="color: #333; margin-bottom: 15px;">Site Location</h3>
      <img src="{{mapImage}}" alt="Site Map" style="width: 100%; height: auto; border: 2px solid #007bff; border-radius: 5px;" />
    </div>
    {{/if}}

    <div>
      <h3 style="color: #333; margin-bottom: 15px;">Key Metrics</h3>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6;">
        <div style="margin-bottom: 15px;">
          <div style="font-size: 24px; font-weight: bold; color: #007bff;">{{areaAcres}}</div>
          <div style="color: #6c757d; font-size: 14px;">Site Area (acres)</div>
        </div>
        <div style="margin-bottom: 15px;">
          <div style="font-size: 18px; font-weight: bold; color: {{#if assessmentData.validation.isValid}}#28a745{{else}}#dc3545{{/if}};">
            {{#if assessmentData.validation.isValid}}Valid{{else}}Review Required{{/if}}
          </div>
          <div style="color: #6c757d; font-size: 14px;">Site Validation</div>
        </div>
      </div>
    </div>
  </div>

  <section style="margin-bottom: 30px;">
    <h3 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">Executive Summary</h3>
    <div style="margin-top: 20px; line-height: 1.6;">
      {{#if aiSummary}}
      <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; margin-bottom: 20px;">
        <h4 style="margin: 0 0 10px 0; color: #007bff;">AI Assessment</h4>
        {{aiSummary}}
      </div>
      {{else}}
      <p>This executive report provides a comprehensive overview of the {{siteName}} site assessment, including proximity analysis, environmental factors, and infrastructure details.</p>
      {{/if}}
    </div>
  </section>

  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px;">
    <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
      <h4 style="margin: 0 0 10px 0; color: #333;">Nearest Airport</h4>
      <div style="font-size: 18px; font-weight: bold; color: #007bff;">
        {{#if assessmentData.airport}}{{assessmentData.airport.distanceKm}} km{{else}}N/A{{/if}}
      </div>
    </div>
    <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
      <h4 style="margin: 0 0 10px 0; color: #333;">Nearest School</h4>
      <div style="font-size: 18px; font-weight: bold; color: #007bff;">
        {{#if assessmentData.school}}{{assessmentData.school.distanceKm}} km{{else}}N/A{{/if}}
      </div>
    </div>
    <div style="text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">
      <h4 style="margin: 0 0 10px 0; color: #333;">Nearest Hospital</h4>
      <div style="font-size: 18px; font-weight: bold; color: #007bff;">
        {{#if assessmentData.hospital}}{{assessmentData.hospital.distanceKm}} km{{else}}N/A{{/if}}
      </div>
    </div>
  </div>

  {{#if integratedData.demographic}}
  <section style="margin-bottom: 30px;">
    <h3 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">Demographic Overview</h3>
    <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
        <h4 style="margin: 0 0 15px 0; color: #333;">Population & Income</h4>
        <div style="margin-bottom: 10px;"><strong>Population:</strong> {{integratedData.demographic.population}} (UK: {{integratedData.demographic.nationalAverages.population}})</div>
        <div style="margin-bottom: 10px;"><strong>Average Income:</strong> £{{integratedData.demographic.averageIncomeGbp}} (UK: £{{integratedData.demographic.nationalAverages.averageIncomeGbp}})</div>
        <div style="margin-bottom: 10px;"><strong>Employment Rate:</strong> {{integratedData.demographic.employmentRate}}% (UK: {{integratedData.demographic.nationalAverages.employmentRate}}%)</div>
        <div><strong>Higher Education:</strong> {{integratedData.demographic.educationLevels.higher}}% (UK: {{integratedData.demographic.nationalAverages.educationHigher}}%)</div>
      </div>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
        <h4 style="margin: 0 0 15px 0; color: #333;">Housing & Age</h4>
        <div style="margin-bottom: 10px;"><strong>Median Age:</strong> {{integratedData.demographic.medianAge}} (UK: {{integratedData.demographic.nationalAverages.medianAge}})</div>
        <div style="margin-bottom: 10px;"><strong>Affordability Index:</strong> {{integratedData.demographic.housingAffordabilityIndex}}x (UK: {{integratedData.demographic.nationalAverages.affordabilityIndex}}x)</div>
        <div style="margin-bottom: 10px;"><strong>Ownership Rate:</strong> {{integratedData.demographic.propertyOwnershipRate}}% (UK: {{integratedData.demographic.nationalAverages.ownershipRate}}%)</div>
        <div><strong>Density:</strong> {{integratedData.demographic.density}}/km² (UK: {{integratedData.demographic.nationalAverages.density}})</div>
      </div>
    </div>
    <div style="margin-top: 20px; font-size: 12px; color: #666;">
      <strong>Data Source:</strong> {{integratedData.demographic.source}} | <strong>Last Updated:</strong> {{integratedData.demographic.timestamp}}
    </div>
  </section>
  {{/if}}

  {{#if integratedData.environmental}}
  <section style="margin-bottom: 30px;">
    <h3 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">Environmental Risk Assessment</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
      {{#if integratedData.environmental.flood}}
      <div style="padding: 20px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0; color: #856404;">Flood Risk</h4>
        <div style="font-size: 16px; font-weight: bold;">{{integratedData.environmental.flood.riskLevel}}</div>
        <div style="margin-top: 5px; color: #856404;">{{integratedData.environmental.flood.percentageAffected}}% of site affected</div>
      </div>
      {{/if}}
      {{#if integratedData.environmental.soil}}
      <div style="padding: 20px; background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0; color: #0c5460;">Soil Quality</h4>
        <div style="font-size: 16px; font-weight: bold;">{{integratedData.environmental.soil.quality}}</div>
        <div style="margin-top: 5px; color: #0c5460;">{{integratedData.environmental.soil.soilType}}</div>
      </div>
      {{/if}}
    </div>
  </section>
  {{/if}}

  <footer style="text-align: center; color: #6c757d; font-size: 12px; margin-top: 40px; border-top: 2px solid #dee2e6; padding-top: 20px;">
    <p>Executive report generated by Prospect Site Assessment System | Confidential</p>
  </footer>
</div>
`,
};

export class PDFReportService {
  private static compiledTemplates: Record<string, HandlebarsTemplateDelegate> =
    {};

  static async generateReport(
    data: ReportData,
    options: PDFOptions = {
      includeCharts: true,
      includeHighResMap: false,
      template: "standard",
      orientation: "portrait",
    }
  ): Promise<void> {
    // Check if we're in a browser environment
    if (typeof window === "undefined") {
      throw new Error(
        "PDF generation is only available in browser environment"
      );
    }
    const pdf = new jsPDF({
      orientation: options.orientation,
      unit: "mm",
      format: "a4",
    });

    // Prepare template data
    const templateData = this.prepareTemplateData(data);

    // Compile template if not already compiled
    if (!this.compiledTemplates[options.template]) {
      this.compiledTemplates[options.template] = Handlebars.compile(
        templates[options.template]
      );
    }

    // Generate HTML content
    const htmlContent = this.compiledTemplates[options.template](templateData);

    // Create temporary element for rendering
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = "absolute";
    tempDiv.style.left = "-9999px";
    tempDiv.style.top = "-9999px";
    tempDiv.style.width =
      options.orientation === "portrait" ? "210mm" : "297mm";
    document.body.appendChild(tempDiv);

    try {
      // Render HTML to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2, // Initial scale, might need adjustment
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");

      // Calculate dimensions to fit A4 page (210mm x 297mm)
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let position = 0;

      // Add image to PDF, handling multiple pages if necessary
      while (position < imgHeight) {
        pdf.addImage(imgData, "PNG", 0, position * -1, imgWidth, imgHeight);
        position += pdfHeight;
        if (position < imgHeight) {
          pdf.addPage();
        }
      }

      // Save PDF
      const fileName = `${data.siteName.replace(
        /\s+/g,
        "_"
      )}_Assessment_Report.pdf`;
      pdf.save(fileName);
    } finally {
      // Clean up
      document.body.removeChild(tempDiv);
    }
  }

  private static prepareTemplateData(data: ReportData) {
    const SQ_METERS_TO_ACRES = 0.000247105;
    const area = data.projectBoundary.area || 0;
    const areaAcres = (area * SQ_METERS_TO_ACRES).toFixed(3);
    const areaSqm = area.toFixed(1);

    // Prepare proximity items for template
    const proximityItems = [];
    if (data.assessmentData.airport) {
      proximityItems.push({
        name: "Airport",
        distance: data.assessmentData.airport.distanceKm,
        distanceMiles: data.assessmentData.airport.distanceMiles,
      });
    }
    if (data.assessmentData.school) {
      proximityItems.push({
        name: "School",
        distance: data.assessmentData.school.distanceKm,
        distanceMiles: data.assessmentData.school.distanceMiles,
      });
    }
    if (data.assessmentData.hospital) {
      proximityItems.push({
        name: "Hospital",
        distance: data.assessmentData.hospital.distanceKm,
        distanceMiles: data.assessmentData.hospital.distanceMiles,
      });
    }
    if (data.assessmentData.highway) {
      proximityItems.push({
        name: "Highway",
        distance: data.assessmentData.highway.distanceKm,
        distanceMiles: data.assessmentData.highway.distanceMiles,
      });
    }
    if (data.assessmentData.town) {
      proximityItems.push({
        name: "Town",
        distance: data.assessmentData.town.distanceKm,
        distanceMiles: data.assessmentData.town.distanceMiles,
      });
    }

    // Preprocess ageDistribution for safe Handlebars keys
    let safeAgeDistribution = {};
    if (data.integratedData?.demographic?.ageDistribution) {
      safeAgeDistribution = Object.fromEntries(
        Object.entries(data.integratedData.demographic.ageDistribution).map(
          ([key, value]) => [key.replace("+", "_plus"), value]
        )
      );
    }

    return {
      ...data,
      areaAcres,
      areaSqm,
      proximityItems,
      safeAgeDistribution,
      generatedAt: new Date().toLocaleString(),
    };
  }

  static async generateHighResMap(
    shape: Shape,
    apiKey: string,
    width: number = 800,
    height: number = 600
  ): Promise<string> {
    // Check if we're in a browser environment
    if (typeof window === "undefined") {
      throw new Error(
        "Map generation is only available in browser environment"
      );
    }
    // Calculate bounds for the map
    const bounds = new google.maps.LatLngBounds();
    shape.path.forEach((p) => bounds.extend(p));

    const center = bounds.getCenter();
    const zoom = this.calculateZoom(bounds);

    // Mapbox Static API URL
    const mapboxUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${center.lng()},${center.lat()},${zoom}/${width}x${height}?access_token=${apiKey}`;

    // Fetch the image
    const response = await fetch(mapboxUrl);
    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }

  private static calculateZoom(bounds: google.maps.LatLngBounds): number {
    const GLOBE_WIDTH = 256; // a constant in Google's map projection
    const west = bounds.getSouthWest().lng();
    const east = bounds.getNorthEast().lng();
    let angle = east - west;
    if (angle < 0) {
      angle += 360;
    }
    const zoom = Math.round(
      Math.log((GLOBE_WIDTH * 360) / angle / 256) / Math.LN2
    );
    return Math.max(1, Math.min(20, zoom));
  }
}

export type { PDFOptions, ReportData };
