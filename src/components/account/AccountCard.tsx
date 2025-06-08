
"use client";

import { useAccountData } from "@/hooks/use-account-data";
import { useApiKey } from "@/hooks/use-api-key";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UserCircle, AlertTriangle } from "lucide-react";

interface DetailItemProps {
  label: string;
  value: string | number | null | undefined;
}

function DetailItem({ label, value }: DetailItemProps) {
  const displayValue = (value === null || value === undefined || String(value).trim() === "") ? "N/A" : String(value);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-1">
      <strong className="w-full sm:w-1/3 text-muted-foreground font-medium">{label}:</strong>
      <span className="w-full sm:w-2/3 text-foreground break-words">{displayValue}</span>
    </div>
  );
}

export function AccountCard() {
  const { apiKey } = useApiKey();
  const { accountData, isLoading, error, refetch } = useAccountData(apiKey);

  return (
    <Card className="border-none shadow-none">
      <CardHeader className="pt-0">
        <CardTitle className="flex items-center text-lg">
          <UserCircle className="mr-2 h-5 w-5" />
          Account Information
        </CardTitle>
        <CardDescription>
          Details associated with your GivEnergy account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center space-x-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading account details...</span>
          </div>
        )}
        {error && !isLoading && (
          <div className="flex items-start space-x-2 text-sm text-destructive p-3 border border-destructive/50 bg-destructive/10 rounded-md">
            <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
            <span>Error: {error}</span>
          </div>
        )}
        {accountData && !isLoading && !error && (
          <div className="space-y-1 text-sm p-3 bg-muted/50 rounded-md">
            <DetailItem label="Full Name" value={`${accountData.first_name || ""} ${accountData.surname || ""}`.trim()} />
            <DetailItem label="Username" value={accountData.name} />
            <DetailItem label="Email" value={accountData.email} />
            <DetailItem label="Role" value={accountData.role} />
            <DetailItem label="Address" value={accountData.address} />
            <DetailItem label="Postcode" value={accountData.postcode} />
            <DetailItem label="Country" value={accountData.country} />
            <DetailItem label="Telephone" value={accountData.telephone_number} />
            <DetailItem label="Timezone" value={accountData.timezone ? `${accountData.timezone} (${accountData.standard_timezone || 'N/A'})` : accountData.standard_timezone} />
            <DetailItem label="Company" value={accountData.company} />
          </div>
        )}
        {!apiKey && !isLoading && !error && (
            <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">API key not set. Account details cannot be fetched.</p>
        )}
      </CardContent>
    </Card>
  );
}
