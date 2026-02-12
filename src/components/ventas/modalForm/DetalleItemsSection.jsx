"use client";

import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import DetalleItemCard from "./DetalleItemCard";

export default function DetalleItemsSection({
  theme,

  detalles,
  addDetalle,
  removeDetalle,
  updateDetalle,

  tipoItems,
  tipoDias,
  empleados,
  tipoItemHH,

  empleadoLabel,
  parseCLPToNumberString,
  toCLPDisplay,

  findHHForEmpleado,
  getHHCIFValue,
  isTipoItemAllowedTipoDia,
  isTipoDiaEnabled,

  mes,
  anio,
  preview,

  formErr,
}) {
  return (
    <Box sx={{ p: 2.5 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography sx={{ fontWeight: 900, fontSize: 18 }}>
          LISTADO DE ÍTEMS
        </Typography>

        <Button
          variant="text"
          startIcon={<AddIcon />}
          onClick={addDetalle}
          sx={{ fontWeight: 900 }}
        >
          AGREGAR ÍTEM
        </Button>
      </Box>

      <Stack spacing={2}>
        {detalles.map((det, idx) => (
          <DetalleItemCard
            key={idx}
            idx={idx}
            det={det}
            detallesLen={detalles.length}
            onRemove={() => removeDetalle(idx)}
            updateDetalle={updateDetalle}
            tipoItems={tipoItems}
            tipoDias={tipoDias}
            empleados={empleados}
            tipoItemHH={tipoItemHH}
            empleadoLabel={empleadoLabel}
            parseCLPToNumberString={parseCLPToNumberString}
            toCLPDisplay={toCLPDisplay}
            findHHForEmpleado={findHHForEmpleado}
            getHHCIFValue={getHHCIFValue}
            isTipoItemAllowedTipoDia={isTipoItemAllowedTipoDia}
            isTipoDiaEnabled={isTipoDiaEnabled}
            mes={mes}
            anio={anio}
            previewLine={preview.lines[idx]}
          />
        ))}

        <Box
          onClick={addDetalle}
          role="button"
          tabIndex={0}
          sx={{
            border: "2px dashed",
            borderColor:
              theme.palette.mode === "dark"
                ? "rgba(15,23,42,.12)"
                : "rgba(15,23,42,.12)",
            borderRadius: 2.5,
            p: 3,
            display: "grid",
            placeItems: "center",
            color: "text.secondary",
            cursor: "pointer",
            bgcolor:
              theme.palette.mode === "dark"
                ? "rgba(248,250,252,1)"
                : "rgba(248,250,252,1)",
            "&:hover": {
              borderColor: "rgba(25,118,210,.35)",
              color: "primary.main",
              bgcolor:
                theme.palette.mode === "dark"
                  ? "rgba(25,118,210,.04)"
                  : "rgba(25,118,210,.04)",
            },
          }}
        >
          <Typography sx={{ fontWeight: 800 }}>
            Haga clic para agregar un nuevo ítem de costo
          </Typography>
        </Box>

        {formErr ? <Alert severity="error">{formErr}</Alert> : null}
      </Stack>
    </Box>
  );
}
