using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.UI;
using System.Web.UI.WebControls;

namespace brain_app_server.brain_app
{
    public partial class saveapp : System.Web.UI.Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            string ip = Request.UserHostAddress;
            string guid = Guid.NewGuid().ToString();
            if ((ip != null) && (!ip.Contains("::"))) guid += ("_" + ip);

            string saveString = Request.Form["save"];
            string path = Server.MapPath("save") + "\\" + guid +".txt";

            try
            {
                System.IO.File.WriteAllText(path, saveString);
            }
            catch
            {
            }

            Response.Write(guid);
        }
    }
}