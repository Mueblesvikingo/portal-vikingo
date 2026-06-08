const SITE_URL =
  "https://mueblesvikingomx.sharepoint.com/sites/Estrategia";

const LIST_NAME = "DECISIONES_ESTRATEGICAS";

export async function createStrategicDecision(data) {
  try {
    const response = await fetch(
      `${SITE_URL}/_api/web/lists/getbytitle('${LIST_NAME}')/items`,
      {
        method: "POST",

        headers: {
          Accept: "application/json;odata=verbose",
          "Content-Type": "application/json;odata=verbose",
          "X-RequestDigest": await getRequestDigest(),
        },

        body: JSON.stringify({
          __metadata: {
            type: "SP.Data.DECISIONES_ESTRATEGICASListItem",
          },

      Title: data.title,
          Responsable: data.owner,
          Riesgo: data.risk,
          Estado: data.status,
          
          Consecuencia: data.consequence,
          Recomendacion: data.recommendation,

          WRAP_Options: data.wrap.options,
          WRAP_Evidence: data.wrap.evidence,
          WRAP_Distance: data.wrap.distance,
          WRAP_Prevention: data.wrap.prevention,

          DecisionFinal: data.wrap.finalDecision,

          Proceso: data.process || "Gestión Estratégica",
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Error al guardar en SharePoint");
    }

    return await response.json();
  } catch (error) {
    console.error("ERROR SHAREPOINT:", error);
    throw error;
  }
}

async function getRequestDigest() {
  const response = await fetch(
    `${SITE_URL}/_api/contextinfo`,
    {
      method: "POST",
      headers: {
        Accept: "application/json;odata=verbose",
      },
    }
  );

  const data = await response.json();

  return data.d.GetContextWebInformation.FormDigestValue;
}