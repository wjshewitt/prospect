"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DemographicsTestPage() {
  const [siteId, setSiteId] = useState("JChnphNOOU6jhOo7ONYn");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clicks, setClicks] = useState(0);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);

  const fetchData = async () => {
    console.log("Fetching data...");
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ons/demographics?site_id=${siteId}`);
      console.log("Fetch complete.");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      setData(result);
      setLastFetchAt(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Demographics API Test Page</h1>
      <div className="flex gap-2 mb-4">
        <Input
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          placeholder="Enter Site ID"
        />
        <Button
          onClick={() => {
            setClicks((c) => c + 1);
            fetchData();
          }}
          disabled={loading}
        >
          {loading ? "Loading..." : "Fetch Data"}
        </Button>
      </div>
      <div className="text-sm text-gray-600 mb-4">
        <span>Clicks: {clicks}</span>
        {lastFetchAt && (
          <span> | Last fetch: {lastFetchAt.toLocaleTimeString()}</span>
        )}
      </div>

      {error && (
        <div className="text-red-500">
          <p>Error: {error}</p>
        </div>
      )}

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>API Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
