"use client";

import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

export function PasswordChangeModal({
  opened,
  isSubmitting,
  value,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  opened: boolean;
  isSubmitting: boolean;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <Dialog open={opened} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set permanent Cognito password</DialogTitle>
          <DialogDescription>
            The Cognito user is still using a temporary password. Set a permanent password to finish
            validation or continue the AWS-backed action.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New permanent password</Label>
            <Input
              id="new-password"
              type="password"
              value={value}
              onChange={(event) => onChange(event.currentTarget.value)}
              placeholder="Enter a permanent password"
              autoFocus
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Password update failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void onSubmit()} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save password and continue"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
