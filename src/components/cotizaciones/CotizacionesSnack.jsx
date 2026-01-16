"use client";

import { Snackbar } from "@mui/material";
import MuiAlert from "@mui/material/Alert";

export default function CotizacionesSnack({ snack, onClose }) {
  return (
    <Snackbar
      open={snack.open}
      autoHideDuration={4000}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      <MuiAlert
        onClose={onClose}
        severity={snack.severity}
        variant="filled"
        sx={{ width: "100%" }}
      >
        {snack.message}
      </MuiAlert>
    </Snackbar>
  );
}
