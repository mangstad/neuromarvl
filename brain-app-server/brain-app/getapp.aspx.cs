using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.UI;
using System.Web.UI.WebControls;

namespace brain_app_server.brain_app
{
    public partial class getapp : System.Web.UI.Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            string filename = Request.Form["filename"];
            string path = Server.MapPath("save") + "\\" + filename + ".txt";

            string json = "";
            try
            {
                json = System.IO.File.ReadAllText(path);
            }
            catch
            {
            }

            Response.Write(json);
        }
    }
}