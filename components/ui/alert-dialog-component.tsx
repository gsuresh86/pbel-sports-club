"use client"

import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface AlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  buttonText?: string
  variant?: "default" | "success" | "error" | "warning"
}

export function CustomAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  buttonText = "OK",
  variant = "default"
}: AlertDialogProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return "bg-green-600 hover:bg-green-700"
      case "error":
        return "bg-red-600 hover:bg-red-700"
      case "warning":
        return "bg-yellow-600 hover:bg-yellow-700"
      default:
        return ""
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction 
            onClick={() => onOpenChange(false)}
            className={getVariantStyles()}
          >
            {buttonText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Hook for easier usage
export function useAlertDialog() {
  const [open, setOpen] = React.useState(false)
  const [config, setConfig] = React.useState<{
    title: string
    description: string
    buttonText?: string
    variant?: "default" | "success" | "error" | "warning"
  } | null>(null)

  const alert = (alertConfig: {
    title: string
    description: string
    buttonText?: string
    variant?: "default" | "success" | "error" | "warning"
  }) => {
    setConfig(alertConfig)
    setOpen(true)
  }

  const AlertDialogComponent = config ? (
    <CustomAlertDialog
      open={open}
      onOpenChange={setOpen}
      title={config.title}
      description={config.description}
      buttonText={config.buttonText}
      variant={config.variant}
    />
  ) : null

  return {
    alert,
    AlertDialogComponent
  }
}
