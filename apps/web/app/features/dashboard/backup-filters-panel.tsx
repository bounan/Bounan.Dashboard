import { Search } from "lucide-react";
import type { AnalyzerFilters, BackupTableDefinition } from "../../lib/types";
import { Card, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { Switch } from "../ui/switch";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";

export function BackupFiltersPanel({
  activeTable,
  tables,
  filters,
  onFiltersChange,
  onTableChange,
}: {
  activeTable: BackupTableDefinition;
  tables: BackupTableDefinition[];
  filters: AnalyzerFilters;
  onFiltersChange: (patch: Partial<AnalyzerFilters>) => void;
  onTableChange: (key: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <Tabs value={activeTable.key} onValueChange={onTableChange}>
          <TabsList className="h-auto flex-wrap">
            {tables.map((table) => (
              <TabsTrigger key={table.key} value={table.key}>
                {table.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid gap-4 xl:grid-cols-[1fr_auto_auto_auto]">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="search"
                className="pl-9"
                placeholder="Search entity, row id, checksum..."
                value={filters.query}
                onChange={(event) => onFiltersChange({ query: event.currentTarget.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={filters.status}
              onChange={(event) =>
                onFiltersChange({ status: event.currentTarget.value as AnalyzerFilters["status"] })
              }
            >
              <option value="all">All statuses</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="healthy">Healthy</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sort">Sort</Label>
            <Select
              id="sort"
              value={`${filters.sortBy}-${filters.sortDirection}`}
              onChange={(event) => {
                const [sortBy, sortDirection] = event.currentTarget.value.split("-");
                onFiltersChange({
                  sortBy: sortBy as AnalyzerFilters["sortBy"],
                  sortDirection: sortDirection as AnalyzerFilters["sortDirection"],
                });
              }}
            >
              <option value="capturedAt-desc">Newest</option>
              <option value="capturedAt-asc">Oldest</option>
              <option value="status-asc">Worst</option>
              <option value="entity-asc">A-Z</option>
            </Select>
          </div>
          <div className="flex items-end gap-3 rounded-lg border border-slate-900 bg-slate-950/60 px-4 py-3">
            <Switch
              checked={filters.issuesOnly}
              onCheckedChange={(checked) => onFiltersChange({ issuesOnly: checked })}
            />
            <div>
              <Label>Show only issues</Label>
              <p className="text-sm text-slate-500">Keep the table focused on unresolved rows.</p>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
